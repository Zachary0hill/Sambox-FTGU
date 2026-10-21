import type { Secret, Config } from '../secrets';

export type SyncResult = { summary: string };

// Each provider module checks a key with one cheap authenticated call, and optionally pulls data.
// verify() returns null when the key works, or a message the Super Admin can act on.
export type ProviderModule = {
  verify(secret: Secret, config: Config): Promise<string | null>;
  sync?(workspaceId: string, secret: Secret, config: Config): Promise<SyncResult>;
};
