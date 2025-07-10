import { config } from 'dotenv';

config();

export interface BetterstackConfig {
  apiToken: string;
  telemetryEndpoint: string;
  queryEndpoint: string;
  defaultSourceGroup?: string;
  defaultSources?: string[];
  cacheTtlSeconds: number;
}

function parseDefaultSources(sources?: string): string[] | undefined {
  if (!sources) return undefined;
  return sources.split(',').map(s => s.trim()).filter(Boolean);
}

export function loadConfig(): BetterstackConfig {
  const apiToken = process.env.BETTERSTACK_API_TOKEN;
  const telemetryEndpoint = process.env.BETTERSTACK_TELEMETRY_ENDPOINT || 'https://telemetry.betterstack.com';
  const queryEndpoint = process.env.BETTERSTACK_QUERY_ENDPOINT || 'https://eu-nbg-2-connect.betterstackdata.com';
  
  if (!apiToken) {
    throw new Error('BETTERSTACK_API_TOKEN environment variable is required');
  }

  return {
    apiToken,
    telemetryEndpoint,
    queryEndpoint,
    defaultSourceGroup: process.env.BETTERSTACK_DEFAULT_SOURCE_GROUP,
    defaultSources: parseDefaultSources(process.env.BETTERSTACK_DEFAULT_SOURCES),
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10)
  };
}