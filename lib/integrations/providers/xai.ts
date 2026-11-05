import 'server-only';
import type { ProviderModule } from './types';

// https://docs.x.ai/developers/rest-api-reference/inference/models
const API = 'https://api.x.ai/v1';
const provider: ProviderModule = {
  async verify(secret, config) {
    const model = String(config.model || '').trim();
    if (!model) return 'Choose a Grok language model.';
    const res = await fetch(API + '/language-models/' + encodeURIComponent(model), {
      headers: { Authorization: 'Bearer ' + secret.apiKey }, signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return null;
    if (res.status === 401 || res.status === 403) return 'The xAI API key was not accepted.';
    if (res.status === 404) return 'That Grok language model is unavailable for this key.';
    return 'xAI returned HTTP ' + res.status + '. Try again shortly.';
  },
  async listModels(secret) {
    const res = await fetch(API + '/language-models', {
      headers: { Authorization: 'Bearer ' + secret.apiKey }, signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('Could not load Grok models (HTTP ' + res.status + '). Check the xAI key.');
    const json = await res.json();
    const models: { id: string; created?: number }[] = Array.isArray(json.models) ? json.models : [];
    return models.filter(m => typeof m.id === 'string').sort((a,b) => (b.created || 0) - (a.created || 0)).map(m => ({ id: m.id, label: m.id }));
  },
};
export default provider;
