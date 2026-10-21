import { after, NextResponse } from 'next/server';
import { workspacesFor, handleEvent, type SlackEnvelope } from '@/lib/integrations/providers/slack';

// Slack Events API request URL. Every request is checked against a connected workspace's signing secret
// (X-Slack-Signature, 5-minute window) before anything else. Slack wants a 2xx within three seconds, so events
// are acknowledged at once and stored after the response.
// Docs: https://docs.slack.dev/apis/events-api/ , https://docs.slack.dev/authentication/verifying-requests-from-slack
export async function POST(request: Request) {
  const raw = await request.text();
  let body: SlackEnvelope;
  try { body = JSON.parse(raw); } catch { return new Response('Bad request', { status: 400 }); }

  const hits = await workspacesFor(raw, request.headers.get('x-slack-request-timestamp'), request.headers.get('x-slack-signature'), body.team_id);
  if (!hits.length) return new Response('Invalid signature', { status: 401, headers: { 'x-slack-no-retry': '1' } });

  if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge });
  if (body.type === 'event_callback') after(() => Promise.all(hits.map((h) => handleEvent(h, body))));
  return new Response(null, { status: 200 });
}
