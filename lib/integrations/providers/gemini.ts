import 'server-only';
import type { ProviderModule } from './types';

// Docs used:
//   https://ai.google.dev/api/models (models.get: GET /v1beta/models/{model}; supportedGenerationMethods)
//   https://ai.google.dev/gemini-api/docs/api-key (key in the x-goog-api-key header)
//   https://ai.google.dev/gemini-api/docs/models (current model codes)

const API = 'https://generativelanguage.googleapis.com/v1beta';

// Checks the key and the configured model with models.get, which costs no tokens.
const provider: ProviderModule = {
  async verify(secret, config) {
    const model = String(config.model || '').trim().replace(/^models\//, '');
    if (!model) return 'Add a model ID.';
    const res = await fetch(API + '/models/' + encodeURIComponent(model), {
      headers: { 'x-goog-api-key': secret.apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      const methods: string[] = Array.isArray(j.supportedGenerationMethods) ? j.supportedGenerationMethods : [];
      return methods.length && !methods.includes('generateContent') ? 'The model "' + model + '" cannot generate text. Pick a chat model.' : null;
    }
    const j = await res.json().catch(() => null);
    const msg = j && j.error && j.error.message ? String(j.error.message) : '';
    if (res.status === 404) return 'The model "' + model + '" was not found. Check the model ID.';
    if (res.status === 401 || res.status === 403 || /api key/i.test(msg)) return 'The API key was not accepted.';
    return msg || 'Gemini returned HTTP ' + res.status + '.';
  },
};

export default provider;
