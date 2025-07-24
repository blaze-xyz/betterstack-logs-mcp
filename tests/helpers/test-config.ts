import { BetterstackConfig } from '../../src/config.js'

export const createTestConfig = (overrides: Partial<BetterstackConfig> = {}): BetterstackConfig => ({
  apiToken: 'test-token-123',
  clickhouseUsername: 'test-username',
  clickhousePassword: 'test-password',
  telemetryEndpoint: 'https://telemetry.betterstack.com',
  clickhouseQueryEndpoint: 'https://clickhouse.betterstack.com',
  cacheTtlSeconds: 300,
  defaultSources: undefined,
  defaultSourceGroup: undefined,
  ...overrides
})

export const testTimeouts = {
  unitTest: 5000,
  integrationTest: 15000,
  e2eTest: 30000
} as const