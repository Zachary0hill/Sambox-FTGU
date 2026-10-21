import 'server-only';
import type { ProviderModule } from './types';
import { modelsError } from './models-error';

// Docs used:
//   https://developers.openai.com/api/reference/resources/models/methods/retrieve (GET /v1/models/{model}, Bearer key)
//   https://developers.openai.com/api/reference/resources/models/methods/list (GET /v1/models: id, created)
//   https://developers.openai.com/api/docs/models (current model IDs; tool calling goes through the Responses API)

const API = 'https://api.openai.com/v1';

// The models list also returns embedding, image, audio and moderation models, which the assistant cannot use.
const CHAT = /^(gpt-|chatgpt-|o\d)/;
const NOT_CHAT = /(embedding|image|audio|realtime|transcribe|tts|whisper|dall-e|moderation|search|instruct)/;

// Checks the key and the configured model with the retrieve-model call, which costs no tokens.
const provider: ProviderModule = {
  async verify(secret, config) {
    const model = String(config.model || '').trim();
    if (!model) return 'Add a model ID.';
    const res = await fetch(API + '/models/' + encodeURIComponent(model), {
      headers: { Authorization: 'Bearer ' + secret.apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return null;
    if (res.status === 401 || res.status === 403) return 'The API key was not accepted.';
    if (res.status === 404) return 'The model "' + model + '" was not found for this key. Check the model ID.';
    const j = await res.json().catch(() => null);
    return (j && j.error && j.error.message) || 'OpenAI returned HTTP ' + res.status + '.';
  },

  // Chat models the key can use, newest first.
  async listModels(secret) {
    const res = await fetch(API + '/models', {
      headers: { Authorization: 'Bearer ' + secret.apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(await modelsError(res, 'OpenAI'));
    const j = await res.json().catch(() => ({}));
    const data: { id: string; created?: number }[] = Array.isArray(j.data) ? j.data : [];
    return data
      .filter((m) => m.id && CHAT.test(m.id) && !NOT_CHAT.test(m.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0) || a.id.localeCompare(b.id))
      .map((m) => ({ id: m.id, label: m.id }));
  },
};

export default provider;
