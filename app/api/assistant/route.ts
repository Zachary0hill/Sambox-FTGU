import { NextResponse } from 'next/server';
import { streamText, isStepCount, APICallError, RetryError, type ModelMessage } from 'ai';
import { getMember, deny } from '@/lib/integrations/auth';
import { getIntegration } from '@/lib/integrations/secrets';
import { providerById } from '@/lib/integrations/registry';
import { workspaceModel } from '@/lib/ai/model';
import { assistantTools, urlsIn } from '@/lib/ai/tools';
import { systemPrompt } from '@/lib/ai/prompt';

// The Daily assistant. Any active member can use it; tools run on their own session, so RLS scopes every answer.
// GET tells the client whether a model is connected (members cannot read the integrations table themselves).
// POST stores the user turn, streams the reply as NDJSON lines, then stores the reply. Write tools only return
// proposals (streamed as `proposal` lines); the member creates them with a click on the Daily page.

export const maxDuration = 60;

const MAX_TEXT = 4000;
const HISTORY = 24;
const HISTORY_CHARS = 24000;
const RATE_PER_HOUR = 30;

const providerName = (id: string) => (providerById(id) || { name: id }).name;

export async function GET() {
  const m = await getMember();
  if (!m) return deny('Sign in to use the assistant.', 401);
  const ws = m.ctx.workspace_id;
  const [wm, fc] = await Promise.all([
    workspaceModel(ws).catch(() => null),
    getIntegration(ws, 'firecrawl').catch(() => null),
  ]);
  return NextResponse.json(
    wm ? { enabled: true, provider: wm.provider, providerName: providerName(wm.provider), model: wm.modelId, web: !!fc } : { enabled: false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// Turns provider and network failures into something a member can act on. Keys and URLs never reach the client.
function readable(err: unknown, name: string): string {
  if (RetryError.isInstance(err)) return readable(err.lastError, name);
  if (APICallError.isInstance(err)) {
    const s = err.statusCode || 0;
    if (s === 401 || s === 403) return name + ' rejected the workspace API key. A Super Admin can update it in Workspace Settings > Integrations.';
    if (s === 404) return name + ' does not recognise the configured model. A Super Admin can change it in Workspace Settings > Integrations.';
    if (s === 429) return name + ' is rate limiting requests or the account is out of credit. Try again in a minute.';
    if (s === 400 && /context|too long|token/i.test(err.message)) return 'This conversation is too long for the model. Start a new chat.';
    if (s >= 500) return name + ' is having trouble right now. Try again shortly.';
    return name + ' returned an error: ' + err.message.slice(0, 300);
  }
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) return 'The answer took too long. Try a narrower question.';
  return 'The assistant could not finish this answer. Try again.';
}

function todayIn(tz: string) {
  const d = new Date();
  try {
    return {
      iso: new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
      weekday: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(d),
      tz,
    };
  } catch {
    return todayIn('UTC');
  }
}

export async function POST(request: Request) {
  const m = await getMember();
  if (!m) return deny('Sign in to use the assistant.', 401);
  const { supabase: sb, ctx } = m;
  const ws = ctx.workspace_id;

  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return deny('Send a JSON object with the message text.', 400);
  const body = raw as Record<string, unknown>;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return deny('Write a message first.', 400);
  if (text.length > MAX_TEXT) return deny('Keep messages under ' + MAX_TEXT + ' characters.', 400);
  const threadIn = typeof body.threadId === 'string' && /^[0-9a-f-]{36}$/i.test(body.threadId) ? body.threadId : null;

  // Per-member rate limit: user turns in the last hour across their own threads.
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const recent = await sb.from('ai_messages').select('id, ai_threads!inner(user_id)', { count: 'exact', head: true })
    .eq('role', 'user').eq('ai_threads.user_id', ctx.user_id).gte('created_at', since);
  if (recent.error) return deny('Could not check your message limit. Try again.', 500);
  if ((recent.count || 0) >= RATE_PER_HOUR) {
    return NextResponse.json({ error: 'You have sent ' + RATE_PER_HOUR + ' messages to the assistant in the last hour. Try again a little later.', code: 'rate_limited' }, { status: 429 });
  }

  const wm = await workspaceModel(ws).catch(() => null);
  if (!wm) return NextResponse.json({ error: 'No AI model is connected. A Super Admin can add one in Workspace Settings > Integrations.', code: 'no_model' }, { status: 409 });

  // Thread and user turn are written on the member's session (ai_threads/ai_messages RLS: own rows only).
  let threadId = threadIn;
  if (threadId) {
    const th = await sb.from('ai_threads').select('id').eq('id', threadId).maybeSingle();
    if (!th.data) return deny('That chat was not found.', 404);
    await sb.from('ai_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
  } else {
    const title = (typeof body.title === 'string' && body.title.trim() ? body.title.trim() : text).slice(0, 80);
    const th = await sb.from('ai_threads').insert({ workspace_id: ws, user_id: ctx.user_id, title }).select('id').single();
    if (th.error) return deny(th.error.message, 400);
    threadId = th.data.id as string;
  }
  const um = await sb.from('ai_messages').insert({ thread_id: threadId, role: 'user', body: text });
  if (um.error) return deny(um.error.message, 400);

  const [hist, st, fc] = await Promise.all([
    sb.from('ai_messages').select('role, body, created_at').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(HISTORY),
    sb.from('workspace_settings').select('*').eq('workspace_id', ws).maybeSingle(),
    getIntegration(ws, 'firecrawl').catch(() => null),
  ]);
  // Oldest first, capped by size, consecutive turns of the same role merged (older threads hold user turns only).
  const rows = ((hist.data || []) as { role: string; body: string }[]).reverse();
  let budget = HISTORY_CHARS;
  const kept: { role: 'user' | 'assistant'; body: string }[] = [];
  for (let i = rows.length - 1; i >= 0 && budget > 0; i--) {
    const b = rows[i].body.slice(0, budget);
    budget -= b.length;
    kept.unshift({ role: rows[i].role === 'assistant' ? 'assistant' : 'user', body: b });
  }
  while (kept.length && kept[0].role !== 'user') kept.shift();
  const messages: ModelMessage[] = [];
  kept.forEach((k) => {
    const last = messages[messages.length - 1];
    if (last && last.role === k.role && typeof last.content === 'string') last.content += '\n\n' + k.body;
    else messages.push(k.role === 'user' ? { role: 'user', content: k.body } : { role: 'assistant', content: k.body });
  });

  const settings = (st.data || {}) as Record<string, unknown>;
  const day = todayIn(String(settings.timezone || 'America/Chicago'));
  const userUrls = rows.filter((r) => r.role === 'user').flatMap((r) => urlsIn(r.body));
  const tools = assistantTools({ member: m, today: day.iso, firecrawlKey: fc ? fc.secret.apiKey || null : null, userUrls });
  const name = providerName(wm.provider);
  const accounts = ((ctx as unknown as { accounts?: { name: string }[] }).accounts || []).map((a) => a.name);

  const result = streamText({
    model: wm.model,
    instructions: systemPrompt({ ctx, today: day.iso, weekday: day.weekday, timezone: day.tz, settings, tools: Object.keys(tools), providerName: name + ' (' + wm.modelId + ')', accounts }),
    messages,
    tools,
    stopWhen: isStepCount(8),
    maxOutputTokens: 4000,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout((maxDuration - 5) * 1000),
    onError: ({ error }) => console.warn('assistant', error instanceof Error ? error.message : error),
  });

  const enc = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')); } catch { closed = true; }
      };
      send({ t: 'thread', id: threadId, provider: wm.provider, model: wm.modelId });
      let reply = '';
      let error = '';
      const used: string[] = [];
      const proposals: Record<string, unknown>[] = [];
      // Keep reading even if the browser goes away, so the reply is still saved to the thread.
      try {
        for await (const part of result.stream) {
          if (part.type === 'text-delta') { reply += part.text; send({ t: 'text', d: part.text }); }
          else if (part.type === 'tool-call') { if (!used.includes(part.toolName)) used.push(part.toolName); send({ t: 'tool', name: part.toolName }); }
          else if (part.type === 'tool-result') {
            const out = part.output as { proposal?: Record<string, unknown> } | null;
            if (out && out.proposal && typeof out.proposal === 'object' && proposals.length < 10) { proposals.push(out.proposal); send({ t: 'proposal', p: out.proposal }); }
          }
          else if (part.type === 'error') error = readable(part.error, name);
          else if (part.type === 'abort') error = 'The answer was stopped before it finished.';
        }
      } catch (err) {
        error = readable(err, name);
      }
      if (!reply.trim() && !proposals.length && !error) error = 'The model did not return an answer. Try rephrasing the question.';
      // Proposals are stored with the reply so their cards (and the Create buttons) survive a reload.
      if (reply.trim() || proposals.length) {
        const saved = await sb.from('ai_messages').insert({
          thread_id: threadId, role: 'assistant', body: reply.trim().slice(0, 20000) || 'Here is the proposal. Nothing is saved until you click the button.',
          meta: { provider: wm.provider, model: wm.modelId, tools: used, ...(proposals.length ? { proposals } : {}), ...(error ? { error } : {}) },
        });
        if (saved.error) console.warn('assistant save', saved.error.message);
        await sb.from('ai_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
      }
      if (error) send({ t: 'error', message: error });
      send({ t: 'done' });
      if (!closed) { closed = true; try { controller.close(); } catch { /* already closed */ } }
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
