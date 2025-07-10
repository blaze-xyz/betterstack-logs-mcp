import { config } from 'dotenv';

config();

export interface BetterstackConfig {
  username: string;
  password: string;
  endpoint: string;
  defaultSourceGroup?: string;
  defaultSources?: string[];
  cacheTtlSeconds: number;
}

function parseDefaultSources(sources?: string): string[] | undefined {
  if (!sources) return undefined;
  return sources.split(',').map(s => s.trim()).filter(Boolean);
}

export function loadConfig(): BetterstackConfig {
  const username = process.env.BETTERSTACK_USERNAME;
  const password = process.env.BETTERSTACK_PASSWORD;
  const endpoint = process.env.BETTERSTACK_ENDPOINT || 'https://eu-nbg-2-connect.betterstackdata.com';
  
  if (!username || !password) {
    throw new Error('BETTERSTACK_USERNAME and BETTERSTACK_PASSWORD environment variables are required');
  }

  return {
    username,
    password,
    endpoint,
    defaultSourceGroup: process.env.BETTERSTACK_DEFAULT_SOURCE_GROUP,
    defaultSources: parseDefaultSources(process.env.BETTERSTACK_DEFAULT_SOURCES),
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10)
  };
}