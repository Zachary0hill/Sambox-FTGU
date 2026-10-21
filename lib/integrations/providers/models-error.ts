import 'server-only';

// A readable reason a models-list call failed, from the provider's error body when it has one.
export async function modelsError(res: Response, name: string): Promise<string> {
  if (res.status === 401 || res.status === 403) return 'The API key was not accepted.';
  const j = await res.json().catch(() => null);
  return (j && j.error && j.error.message) || name + ' returned HTTP ' + res.status + '.';
}
