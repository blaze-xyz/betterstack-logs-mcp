import { faker } from "@faker-js/faker";
import {
  BetterstackApiSource,
  BetterstackApiSourceGroup,
} from "../../src/types.js";

// Mock sources data
export const mockApiSources: BetterstackApiSource[] = [
  {
    id: "1021715",
    type: "source",
    attributes: {
      team_id: 12345,
      team_name: "Engineering Team",
      name: "Spark - staging | deprecated",
      source_group_id: 1,
      table_name: "spark_staging",
      platform: "ubuntu",
      token: "test-token-123",
      ingesting_host: "logs.betterstack.com",
      ingesting_paused: false,
      logs_retention: 7,
      metrics_retention: 30,
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    },
  },
  {
    id: "1021716",
    type: "source",
    attributes: {
      team_id: 12345,
      team_name: "Engineering Team",
      name: "Production API Server",
      source_group_id: 2,
      table_name: "production_api",
      platform: "linux",
      token: "test-token-456",
      ingesting_host: "logs.betterstack.com",
      ingesting_paused: false,
      logs_retention: 30,
      metrics_retention: 90,
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    },
  },
  {
    id: "1021717",
    type: "source",
    attributes: {
      team_id: 12345,
      team_name: "Engineering Team",
      name: "Frontend Application",
      source_group_id: 1,
      table_name: "frontend_app",
      platform: "docker",
      token: "test-token-789",
      ingesting_host: "logs.betterstack.com",
      ingesting_paused: false,
      logs_retention: 14,
      metrics_retention: 60,
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    },
  },
  {
    id: "1021718",
    type: "source",
    attributes: {
      team_id: 12345,
      team_name: "Engineering Team",
      name: "Database Service",
      source_group_id: 1,
      table_name: "database_service",
      platform: "kubernetes",
      token: "test-token-101112",
      ingesting_host: "logs.betterstack.com",
      ingesting_paused: false,
      logs_retention: 21,
      metrics_retention: 75,
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    },
  },
];

// Mock source groups data
export const mockApiSourceGroups: BetterstackApiSourceGroup[] = [
  {
    id: "1",
    type: "source_group",
    attributes: {
      id: 1,
      name: "Development Environment",
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      sort_index: 0,
      team_name: "Engineering Team",
    },
  },
  {
    id: "2",
    type: "source_group",
    attributes: {
      id: 2,
      name: "Production Environment",
      created_at: "2024-01-01T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      sort_index: 1,
      team_name: "Engineering Team",
    },
  },
];

// Mock logs data - matches ClickHouse schema (dt, raw, level, json, source)
// Uses JSON format to match our simplified level filtering pattern
export const mockLogs = Array.from({ length: 50 }, (_, i) => {
  const level = faker.helpers.arrayElement(["info", "warn", "error", "debug"]); // lowercase to match real logs

  return {
    dt: new Date(Date.now() - i * 60000).toISOString(),
    raw: `{"dt":"${new Date(
      Date.now() - i * 60000
    ).toISOString()}","level":"${level}","message":"${faker.lorem.sentence()}","context":"${faker.lorem.word()}"}`, // JSON format matching real Spark Cron logs
    level: level,
    json: {
      host: faker.internet.domainName(),
      severity: level,
      request_id: faker.string.uuid(),
    },
    source: faker.helpers.arrayElement([
      "Production API Server",
      "Frontend Application",
    ]),
  };
});

// Mock ClickHouse query response
export const mockClickHouseResponse = {
  data: mockLogs,
  rows: mockLogs.length,
  statistics: {
    elapsed: 0.001,
    rows_read: mockLogs.length,
    bytes_read: 1024,
  },
};

// Helper functions for generating dynamic mock data
export const generateMockSource = (
  overrides: Partial<BetterstackApiSource["attributes"]> = {}
): BetterstackApiSource => ({
  id: faker.string.numeric(7),
  type: "source",
  attributes: {
    team_id: 12345,
    team_name: faker.company.name() + " Team",
    name: faker.company.name() + " Server",
    source_group_id: faker.number.int({ min: 1, max: 5 }),
    table_name: faker.string.alphanumeric(10),
    platform: faker.helpers.arrayElement([
      "ubuntu",
      "linux",
      "docker",
      "kubernetes",
    ]),
    token: faker.string.alphanumeric(20),
    ingesting_host: "logs.betterstack.com",
    ingesting_paused: false,
    logs_retention: faker.helpers.arrayElement([7, 14, 30, 90]),
    metrics_retention: faker.helpers.arrayElement([30, 60, 90, 180]),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  },
});

export const generateMockSourceGroup = (
  overrides: Partial<BetterstackApiSourceGroup["attributes"]> = {}
): BetterstackApiSourceGroup => ({
  id: faker.string.numeric(1),
  type: "source_group",
  attributes: {
    id: faker.number.int({ min: 1, max: 100 }),
    name:
      faker.helpers.arrayElement(["Development", "Staging", "Production"]) +
      " Environment",
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    sort_index: faker.number.int({ min: 0, max: 10 }),
    team_name: faker.company.name() + " Team",
    ...overrides,
  },
});
