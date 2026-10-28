import type { Secret, Config } from '../secrets';

export type SyncResult = { summary: string };

// What a sync can bring over, for the picker shown before a manual sync. Each group is a checklist; `on` is the
// default. A SyncPick maps group id -> the item ids to bring over; a group left out of the pick means all of it.
export type SyncPreview = { groups: { id: string; label: string; hint?: string; items: { id: string; label: string; note?: string; on: boolean }[] }[] };
export type SyncPick = Record<string, string[]>;

export type ModelOption = { id: string; label: string };

// Each provider module checks a key with one cheap authenticated call, and optionally pulls data. preview() lists
// what sync() would bring over so a Super Admin can pick before a manual sync; scheduled syncs pass no pick.
// verify() returns null when the key works, or a message the Super Admin can act on.
// AI providers also list the chat models a key can use, for the Model dropdown in Settings.
export type ProviderModule = {
  verify(secret: Secret, config: Config): Promise<string | null>;
  listModels?(secret: Secret): Promise<ModelOption[]>;
  sync?(workspaceId: string, secret: Secret, config: Config, pick?: SyncPick): Promise<SyncResult>;
  preview?(workspaceId: string, secret: Secret, config: Config): Promise<SyncPreview>;
};
