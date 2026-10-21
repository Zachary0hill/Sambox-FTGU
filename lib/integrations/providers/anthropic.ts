import 'server-only';
import type { ProviderModule } from './types';
import { modelsError } from './models-error';

// Docs used:
//   https://platform.claude.com/docs/en/api/models (GET /v1/models/{model_id}, x-api-key + anthropic-version headers)
//   https://platform.claude.com/docs/en/api/models-list (GET /v1/models, newest first, display_name)
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

  // Every model the key can use, newest first. Retired models are left out.
  async listModels(secret) {
    const res = await fetch(API + '/models?limit=1000', {
      headers: { 'x-api-key': secret.apiKey, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(await modelsError(res, 'Anthropic'));
    const j = await res.json().catch(() => ({}));
    const data: { id: string; display_name?: string; lifecycle?: string }[] = Array.isArray(j.data) ? j.data : [];
    return data.filter((m) => m.id && m.lifecycle !== 'retired').map((m) => ({ id: m.id, label: m.display_name || m.id }));
  },
};

export default provider;
