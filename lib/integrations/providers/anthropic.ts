import 'server-only';
import type { ProviderModule } from './types';

// Docs used:
//   https://platform.claude.com/docs/en/api/models (GET /v1/models/{model_id}, x-api-key + anthropic-version headers)
//   https://platform.claude.com/docs/en/about-claude/models/overview (current model IDs)

const API = 'https://api.anthropic.com/v1';

// Checks the key and the configured model with one call to the Models API, which costs no tokens.
const provider: ProviderModule = {
  async verify(secret, config) {
    const model = String(config.model || '').trim();
    if (!model) return 'Add a model ID.';
    const res = await fetch(API + '/models/' + encodeURIComponent(model), {
      headers: { 'x-api-key': secret.apiKey, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      return j.lifecycle === 'retired' ? 'The model "' + model + '" is retired. Pick a current model ID.' : null;
    }
    if (res.status === 401 || res.status === 403) return 'The API key was not accepted.';
    if (res.status === 404) return 'The model "' + model + '" was not found. Check the model ID.';
    const j = await res.json().catch(() => null);
    return (j && j.error && j.error.message) || 'Anthropic returned HTTP ' + res.status + '.';
  },
};

export default provider;
