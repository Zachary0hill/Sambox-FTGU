// Integrations a Super Admin can connect from Workspace Settings > Integrations. Shared by the Settings UI and the
// server routes, so nothing secret lives here: fields marked `secret` go to Supabase Vault, the rest to
// integrations.config.

export type ProviderId =
  | 'anthropic' | 'openai' | 'gemini' | 'monday' | 'apify' | 'browserbase' | 'firecrawl' | 'slack' | 'youtube' | 'buffer';

export type ProviderGroup = 'ai' | 'projects' | 'research' | 'inbox' | 'content';

export type ProviderField = {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: string;
  // 'models': picked from a dropdown of the models the key can use (the provider module's listModels).
  choices?: 'models';
};

export type ProviderDef = {
  id: ProviderId;
  name: string;
  group: ProviderGroup;
  docs: string;
  keyUrl: string;
  fields: ProviderField[];
  canSync?: boolean;
};

export const GROUPS: [ProviderGroup, string, string][] = [
  ['ai', 'AI models', 'Power the Daily assistant and the research agent. Pick which one the assistant uses.'],
  ['projects', 'Projects', 'Keep the board in step with your project tools.'],
  ['research', 'Research and agent tools', 'Let the research agent and assistant search, scrape and browse the web.'],
  ['inbox', 'Inbox', 'Bring messages from other tools into the Inbox.'],
  ['content', 'Content and analytics', 'Show posted videos and social performance on the Content page.'],
];

export const AI_PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini'];

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic', name: 'Claude', group: 'ai',
    docs: 'https://docs.claude.com/en/api/overview', keyUrl: 'https://console.anthropic.com/settings/keys',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true, placeholder: 'sk-ant-...' },
      { key: 'model', label: 'Model', defaultValue: 'claude-sonnet-5-5', choices: 'models', help: 'Models this key can use, newest first.' },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', group: 'ai',
    docs: 'https://platform.openai.com/docs/api-reference', keyUrl: 'https://platform.openai.com/api-keys',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true, placeholder: 'sk-...' },
      { key: 'model', label: 'Model', defaultValue: 'gpt-6.1-sol', choices: 'models', help: 'Chat models this key can use, newest first.' },
    ],
  },
  {
    id: 'gemini', name: 'Gemini', group: 'ai',
    docs: 'https://ai.google.dev/gemini-api/docs', keyUrl: 'https://aistudio.google.com/apikey',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true, placeholder: 'AIza...' },
      { key: 'model', label: 'Model', defaultValue: 'gemini-3.8-flash', choices: 'models', help: 'Text models this key can use.' },
    ],
  },
  {
    id: 'monday', name: 'monday.com', group: 'projects', canSync: true,
    docs: 'https://developer.monday.com/api-reference/docs', keyUrl: 'https://developer.monday.com/api-reference/docs/authentication',
    fields: [
      { key: 'apiToken', label: 'API token', secret: true, placeholder: 'Personal API token', help: 'Profile picture > Developers > My access tokens.' },
      { key: 'boardId', label: 'Board ID', placeholder: '1234567890', help: 'The number in the board URL.' },
      { key: 'statusColumnId', label: 'Status column ID', optional: true, placeholder: 'status', help: 'Leave blank to use the board\'s first status column.' },
      { key: 'statusMap', label: 'Status mapping', optional: true, placeholder: 'Working on it=Editing, Done=Live', help: 'monday label=board status, comma separated. Labels with the same name match without it.' },
      { key: 'jobColumnId', label: 'Job number column ID', optional: true, placeholder: 'text', help: 'Optional. Links items to projects with the same job number; new items use it as their job number.' },
    ],
  },
  {
    id: 'apify', name: 'Apify', group: 'research',
    docs: 'https://docs.apify.com/api/v2', keyUrl: 'https://console.apify.com/settings/integrations',
    fields: [{ key: 'apiToken', label: 'API token', secret: true, placeholder: 'apify_api_...' }],
  },
  {
    id: 'browserbase', name: 'Browserbase', group: 'research',
    docs: 'https://docs.browserbase.com', keyUrl: 'https://www.browserbase.com/settings',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true, placeholder: 'bb_live_...' },
      { key: 'projectId', label: 'Project ID', placeholder: 'Project ID from Settings' },
    ],
  },
  {
    id: 'firecrawl', name: 'Firecrawl', group: 'research',
    docs: 'https://docs.firecrawl.dev', keyUrl: 'https://www.firecrawl.dev/app/api-keys',
    fields: [{ key: 'apiKey', label: 'API key', secret: true, placeholder: 'fc-...' }],
  },
  {
    id: 'slack', name: 'Slack', group: 'inbox', canSync: true,
    docs: 'https://docs.slack.dev/apis/web-api', keyUrl: 'https://api.slack.com/apps',
    fields: [
      { key: 'botToken', label: 'Bot token', secret: true, placeholder: 'xoxb-...', help: 'From your Slack app\'s OAuth & Permissions page.' },
      { key: 'signingSecret', label: 'Signing secret', secret: true, optional: true, placeholder: 'For real-time events once deployed', help: 'Basic Information > App Credentials. Needed for live events at /api/webhooks/slack.' },
      { key: 'channels', label: 'Channels to watch', optional: true, placeholder: 'C0123ABCD, C0456EFGH', help: 'Channel IDs or names, comma separated. Blank watches every channel the bot is in. Mentions and DMs always come through.' },
    ],
  },
  {
    id: 'youtube', name: 'YouTube', group: 'content', canSync: true,
    docs: 'https://developers.google.com/youtube/v3/docs', keyUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true, placeholder: 'AIza...', help: 'A Google Cloud key with YouTube Data API v3 enabled. Application restrictions: None or IP addresses (the sync runs on the server).' },
      { key: 'channelIds', label: 'Channels', placeholder: 'UC..., @handle', help: 'Channel IDs or @handles, comma separated. The ID is under YouTube Studio > Settings > Channel > Advanced settings.' },
    ],
  },
  {
    id: 'buffer', name: 'Buffer', group: 'content', canSync: true,
    docs: 'https://developers.buffer.com', keyUrl: 'https://publish.buffer.com/settings/api',
    fields: [{
      key: 'apiKey', label: 'API key', secret: true, placeholder: 'Buffer API key',
      help: 'In Buffer: Settings > API > create a key. Brings channels, sent posts and post metrics to the Content page. Buffer\'s API does not share comments or DMs, so those stay in Buffer.',
    }],
  },
];

export const providerById = (id: string): ProviderDef | undefined => PROVIDERS.find((p) => p.id === id);
