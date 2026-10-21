import type { Secret, Config } from '../secrets';

export type SyncResult = { summary: string };

export type ModelOption = { id: string; label: string };

// Each provider module checks a key with one cheap authenticated call, and optionally pulls data.
// verify() returns null when the key works, or a message the Super Admin can act on.
// AI providers also list the chat models a key can use, for the Model dropdown in Settings.
export type ProviderModule = {
  verify(secret: Secret, config: Config): Promise<string | null>;
  listModels?(secret: Secret): Promise<ModelOption[]>;
  sync?(workspaceId: string, secret: Secret, config: Config): Promise<SyncResult>;
};
