import { faker } from '@faker-js/faker'
import { BetterstackApiSource, BetterstackApiSourceGroup } from '../../src/types.js'

// Mock sources data
export const mockApiSources: BetterstackApiSource[] = [
  {
    id: "1021715",
    type: "source",
    attributes: {
      name: "Spark - staging | deprecated",
      platform: "ubuntu",
      logs_retention: 7,
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      source_group_id: 1,
      table_name: "spark_staging_logs",
      team_id: 12345
    }
  },
  {
    id: "1021716",
    type: "source", 
    attributes: {
      name: "Production API Server",
      platform: "linux",
      logs_retention: 30,
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      source_group_id: 2,
      table_name: "production_api_logs",
      team_id: 12345
    }
  },
  {
    id: "1021717",
    type: "source",
    attributes: {
      name: "Frontend Application",
      platform: "docker",
      logs_retention: 14,
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      source_group_id: 1,
      table_name: "frontend_app_logs",
      team_id: 12345
    }
  }
]

// Mock source groups data
export const mockApiSourceGroups: BetterstackApiSourceGroup[] = [
  {
    id: "1",
    type: "source_group",
    attributes: {
      name: "Development Environment",
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      sort_index: 0,
      team_name: "Engineering Team"
    }
  },
  {
    id: "2", 
    type: "source_group",
    attributes: {
      name: "Production Environment",
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      sort_index: 1,
      team_name: "Engineering Team"
    }
  }
]

// Mock logs data
export const mockLogs = Array.from({ length: 50 }, (_, i) => ({
  timestamp: new Date(Date.now() - i * 60000).toISOString(),
  message: faker.lorem.sentence(),
  severity: faker.helpers.arrayElement(['info', 'warn', 'error', 'debug']),
  source: faker.helpers.arrayElement(['Production API Server', 'Frontend Application']),
  host: faker.internet.domainName(),
  level: faker.helpers.arrayElement(['INFO', 'WARN', 'ERROR', 'DEBUG'])
}))

// Mock ClickHouse query response
export const mockClickHouseResponse = {
  data: mockLogs,
  rows: mockLogs.length,
  statistics: {
    elapsed: 0.001,
    rows_read: mockLogs.length,
    bytes_read: 1024
  }
}

// Helper functions for generating dynamic mock data
export const generateMockSource = (overrides: Partial<BetterstackApiSource['attributes']> = {}): BetterstackApiSource => ({
  id: faker.string.numeric(7),
  type: "source",
  attributes: {
    name: faker.company.name() + " Server",
    platform: faker.helpers.arrayElement(['ubuntu', 'linux', 'docker', 'kubernetes']),
    logs_retention: faker.helpers.arrayElement([7, 14, 30, 90]),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    source_group_id: faker.number.int({ min: 1, max: 5 }),
    table_name: faker.string.alphanumeric(10) + "_logs",
    team_id: 12345,
    ...overrides
  }
})

export const generateMockSourceGroup = (overrides: Partial<BetterstackApiSourceGroup['attributes']> = {}): BetterstackApiSourceGroup => ({
  id: faker.string.numeric(1),
  type: "source_group",
  attributes: {
    name: faker.helpers.arrayElement(['Development', 'Staging', 'Production']) + " Environment",
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    sort_index: faker.number.int({ min: 0, max: 10 }),
    team_name: faker.company.name() + " Team",
    ...overrides
  }
})