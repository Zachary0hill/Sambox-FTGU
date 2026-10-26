import 'server-only';
import type { ProviderId } from '../registry';
import type { ProviderModule } from './types';
import anthropic from './anthropic';
import openai from './openai';
import gemini from './gemini';
import monday from './monday';
import apify from './apify';
import browserbase from './browserbase';
import firecrawl from './firecrawl';
import slack from './slack';
import youtube from './youtube';
import buffer from './buffer';
import n8n from './n8n';

export const MODULES: Record<ProviderId, ProviderModule> = {
  anthropic, openai, gemini, monday, apify, browserbase, firecrawl, slack, youtube, buffer, n8n,
};
