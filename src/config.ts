import { config } from 'dotenv';

config();

export interface BetterstackConfig {
  // ClickHouse Database Authentication (for log queries)
  clickhouseUsername: string;
  clickhousePassword: string;
  queryEndpoint: string;
  
  // Telemetry API Authentication (for source management)
  apiToken: string;
  telemetryEndpoint: string;
  
  // General Configuration
  defaultSourceGroup?: string;
  defaultSources?: string[];
  cacheTtlSeconds: number;
}

function parseDefaultSources(sources?: string): string[] | undefined {
  if (!sources) return undefined;
  return sources.split(',').map(s => s.trim()).filter(Boolean);
}

export function loadConfig(): BetterstackConfig {
  // ClickHouse credentials for log queries
  const clickhouseUsername = process.env.BETTERSTACK_CLICKHOUSE_USERNAME;
  const clickhousePassword = process.env.BETTERSTACK_CLICKHOUSE_PASSWORD;
  const queryEndpoint = process.env.BETTERSTACK_QUERY_ENDPOINT || 'https://eu-nbg-2-connect.betterstackdata.com';
  
  // API token for source management
  const apiToken = process.env.BETTERSTACK_API_TOKEN;
  const telemetryEndpoint = process.env.BETTERSTACK_TELEMETRY_ENDPOINT || 'https://telemetry.betterstack.com';
  
  // Validate required credentials
  if (!clickhouseUsername || !clickhousePassword) {
    throw new Error('BETTERSTACK_CLICKHOUSE_USERNAME and BETTERSTACK_CLICKHOUSE_PASSWORD environment variables are required for log queries');
  }
  
  if (!apiToken) {
    throw new Error('BETTERSTACK_API_TOKEN environment variable is required for source management');
  }

  return {
    clickhouseUsername,
    clickhousePassword,
    queryEndpoint,
    apiToken,
    telemetryEndpoint,
    defaultSourceGroup: process.env.BETTERSTACK_DEFAULT_SOURCE_GROUP,
    defaultSources: parseDefaultSources(process.env.BETTERSTACK_DEFAULT_SOURCES),
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10)
  };
}