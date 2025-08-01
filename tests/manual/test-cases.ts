/**
 * Manual Test Cases - Structured test definitions for semi-automated testing
 *
 * This file contains all test cases from the manual testing checklist in a structured format
 * that can be executed programmatically while maintaining human readability.
 *
 * Updated to reflect current MCP server functionality as of 2025-07-31:
 * - Source management tools (list_sources, get_source_info, etc.)
 * - Log querying with filters (query_logs)
 * - Connection testing (test_connection, debug_table_info)
 */

export interface ManualTestCase {
  id: string;
  description: string;
  category: string;
  payload: {
    name: string;
    arguments: Record<string, any>;
  };
  jsonRpcPayload?: {
    jsonrpc: "2.0";
    method: string;
    params: {
      name: string;
      arguments: Record<string, any>;
    };
    id: number;
  };
  expected: {
    shouldContain?: string[];
    shouldNotContain?: string[];
    format?: string;
    resultCount?: number | { min?: number; max?: number };
    notes?: string;
  };
  mockData?: any[];
}

export interface TestCategory {
  [testKey: string]: ManualTestCase;
}

export interface ManualTestSuite {
  [categoryKey: string]: TestCategory;
}

export const manualTestCases: ManualTestSuite = {
  "source-management": {
    "list-sources": {
      id: "1.1",
      description: "List all available log sources",
      category: "Source Management Tests",
      payload: {
        name: "list_sources",
        arguments: {},
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "list_sources",
          arguments: {},
        },
        id: 1,
      },
      expected: {
        shouldContain: ["Available Log Sources", "ID:"],
        resultCount: { min: 1 },
        notes: "Should return at least one configured source",
      },
      mockData: [
        {
          id: "1386515",
          name: "Test Source",
          platform: "ubuntu",
          retention_days: 30,
        },
      ],
    },
    "list-source-groups": {
      id: "1.2",
      description: "List all source groups",
      category: "Source Management Tests",
      payload: {
        name: "list_source_groups",
        arguments: {},
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "list_source_groups",
          arguments: {},
        },
        id: 2,
      },
      expected: {
        shouldContain: ["Source Groups"],
        notes:
          "May return empty if no groups configured or if team token needed",
      },
      mockData: [
        { id: "group1", name: "Production Logs", source_ids: ["1386515"] },
      ],
    },
    "get-source-info": {
      id: "1.3",
      description: "Get detailed information about a specific source",
      category: "Source Management Tests",
      payload: {
        name: "get_source_info",
        arguments: {
          source_id: "1386515",
        },
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "get_source_info",
          arguments: {
            source_id: "1386515",
          },
        },
        id: 3,
      },
      expected: {
        shouldContain: ["Source:", "ID:", "Platform:"],
        notes: "Should return detailed source information",
      },
      mockData: [{ id: "1386515", name: "Test Source", platform: "ubuntu" }],
    },
    "get-source-group-info": {
      id: "1.4",
      description: "Get detailed information about a source group",
      category: "Source Management Tests",
      payload: {
        name: "get_source_group_info",
        arguments: {
          group_name: "Production",
        },
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "get_source_group_info",
          arguments: {
            group_name: "Production",
          },
        },
        id: 4,
      },
      expected: {
        shouldContain: ["Source Group:", "Total Sources:", "Sources:"],
        notes: "Should return detailed source group information",
      },
      mockData: [{ id: "group1", name: "Production", source_ids: ["1386515"] }],
    },
    "test-connection": {
      id: "1.5",
      description: "Test connection to BetterStack APIs",
      category: "Source Management Tests",
      payload: {
        name: "test_connection",
        arguments: {},
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "test_connection",
          arguments: {},
        },
        id: 5,
      },
      expected: {
        shouldContain: ["Connection"],
        notes: "Should verify both Telemetry API and ClickHouse connectivity",
      },
      mockData: [],
    },
  },

  "single-source-log-querying": {
    "basic-query": {
      id: "2.1",
      description: "Basic log query without filters",
      category: "Single Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5,
        },
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query_logs",
          arguments: {
            sources: ["1386515"],
            limit: 5,
          },
        },
        id: 6,
      },
      expected: {
        shouldContain: ["Query Results", "dt:", "raw:"],
        resultCount: { max: 5 },
        notes: "Should return recent logs with timestamp and raw message",
      },
      mockData: [
        { dt: "2024-01-01T10:00:00Z", raw: "Test log entry 1" },
        { dt: "2024-01-01T10:01:00Z", raw: "Test log entry 2" },
      ],
    },
    "raw-content-search": {
      id: "2.2",
      description: "Search logs by raw content substring",
      category: "Single Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: ["error"],
          },
          sources: ["1386515"],
          limit: 10,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes:
          "Should return logs containing 'error' substring (case-insensitive)",
      },
      mockData: [
        {
          dt: "2024-01-01T10:00:00Z",
          raw: "ERROR: Database connection failed",
        },
        {
          dt: "2024-01-01T10:01:00Z",
          raw: "Application error in authentication",
        },
      ],
    },
    "level-filtering": {
      id: "2.3",
      description: "Filter logs by level",
      category: "Single Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            level: "ERROR",
          },
          sources: ["1386515"],
          limit: 10,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should return logs with ERROR level using pattern matching",
      },
      mockData: [
        {
          dt: "2024-01-01T10:00:00Z",
          raw: '{"level":"error","message":"Database failed"}',
        },
      ],
    },
    "time-filtering-relative": {
      id: "2.4",
      description: "Filter logs by relative time range",
      category: "Single Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_filter: {
              relative: "last_30_minutes",
            },
          },
          sources: ["1386515"],
          limit: 10,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should return logs from last 30 minutes only",
      },
      mockData: [{ dt: "2024-01-01T10:45:00Z", raw: "Recent log entry" }],
    },
    "time-filtering-custom": {
      id: "2.5",
      description: "Filter logs by custom time range",
      category: "Single Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_filter: {
              custom: {
                start_datetime: "2025-07-30T10:00:00Z",
                end_datetime: "2025-07-30T12:00:00Z",
              },
            },
          },
          sources: ["1386515"],
          limit: 10,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should return logs within specified custom time range",
      },
      mockData: [
        { dt: "2025-07-30T10:30:00Z", raw: "Log within custom time range" },
      ],
    },
    "combined-filters": {
      id: "2.6",
      description: "Combine multiple filters",
      category: "Single Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: ["login"],
            level: "ERROR",
            time_filter: {
              relative: "last_24_hours",
            },
          },
          sources: ["1386515"],
          limit: 15,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 15 },
        notes:
          "Should return ERROR level logs containing 'login' from last 24h",
      },
      mockData: [
        { dt: "2024-01-01T10:00:00Z", raw: "ERROR: Login failed for user" },
      ],
    },

    "multi-keyword-raw-search": {
      id: "2.7",
      description: "Search logs using multiple keywords (all must be present)",
      category: "Single Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: ["clziajzvi0003lvw5g1do1jyk", "confirm"],
          },
          sources: ["1386515"],
          limit: 5,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 5 },
        notes:
          "Should return logs containing both user ID 'clziajzvi0003lvw5g1do1jyk' AND keyword 'confirm' - keywords don't need to be adjacent",
      },
      mockData: [
        {
          dt: "2024-01-01T10:00:00Z",
          raw: "User clziajzvi0003lvw5g1do1jyk requested confirm action for profile update",
        },
        {
          dt: "2024-01-01T10:01:00Z",
          raw: "Action confirm completed for user clziajzvi0003lvw5g1do1jyk with success status",
        },
        {
          dt: "2024-01-01T10:02:00Z",
          raw: "Email confirm sent to clziajzvi0003lvw5g1do1jyk@example.com for verification",
        },
      ],
    },
  },

  "multi-source-log-querying": {
    "basic-multi-source-query": {
      id: "3.1",
      description: "Basic log query across multiple sources",
      category: "Multi-Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515", "1442440"],
          limit: 5,
        },
      },
      expected: {
        shouldContain: ["Query Results", "dt:", "raw:"],
        resultCount: { max: 5 },
        notes:
          "Should return recent logs from both Spark Production and App Production sources",
      },
      mockData: [
        { dt: "2024-01-01T10:00:00Z", raw: "Spark production log entry" },
        { dt: "2024-01-01T10:01:00Z", raw: "App production log entry" },
      ],
    },
    "multi-source-content-search": {
      id: "3.2",
      description: "Search logs across multiple sources by content",
      category: "Multi-Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: ["error"],
          },
          sources: ["1386515", "1442440"],
          limit: 10,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes:
          "Should return error logs from both Spark and App production sources",
      },
      mockData: [
        {
          dt: "2024-01-01T10:00:00Z",
          raw: "ERROR: Spark production database failed",
        },
        {
          dt: "2024-01-01T10:01:00Z",
          raw: "ERROR: App production authentication error",
        },
      ],
    },
    "multi-source-time-filtering": {
      id: "3.3",
      description: "Filter logs across multiple sources by time",
      category: "Multi-Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_filter: {
              relative: "last_60_minutes",
            },
          },
          sources: ["1386515", "1442440"],
          limit: 15,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 15 },
        notes: "Should return logs from both sources within last hour",
      },
      mockData: [
        { dt: "2024-01-01T10:30:00Z", raw: "Recent Spark production log" },
        { dt: "2024-01-01T10:45:00Z", raw: "Recent App production log" },
      ],
    },
    "multi-source-historical-july": {
      id: "3.4",
      description:
        "Historical multi-source query for July 25-26, 2025 (pure historical data)",
      category: "Multi-Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_filter: {
              custom: {
                start_datetime: "2025-07-25T08:00:00Z",
                end_datetime: "2025-07-26T20:00:00Z",
              },
            },
            level: "ERROR",
          },
          sources: ["1386515", "1442440"],
          limit: 150,
        },
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query_logs",
          arguments: {
            filters: {
              time_filter: {
                custom: {
                  start_datetime: "2025-07-25T08:00:00Z",
                  end_datetime: "2025-07-26T20:00:00Z",
                },
              },
              level: "ERROR",
            },
            sources: ["1386515", "1442440"],
            limit: 150,
          },
        },
        id: 31,
      },
      expected: {
        shouldContain: [
          "Query Results",
          "s3Cluster(primary,",
          "parseDateTime64BestEffort('2025-07-25T08:00:00Z')",
          "parseDateTime64BestEffort('2025-07-26T20:00:00Z')",
          'ilike(raw, \'%"level":"error"%\')',
        ],
        shouldNotContain: ["remote("],
        resultCount: { max: 150 },
        notes:
          "Should use pure historical (s3Cluster) queries only for July 25-26, 2025 data, no remote() tables",
      },
      mockData: [
        {
          dt: "2025-07-25T10:30:00Z",
          raw: "ERROR: Production database connection failed",
        },
        {
          dt: "2025-07-25T14:45:00Z",
          raw: "ERROR: Production API timeout in authentication service",
        },
        {
          dt: "2025-07-26T18:15:00Z",
          raw: "ERROR: Production cache service unavailable",
        },
      ],
    },
    "complex-multi-filter-historical": {
      id: "3.5",
      description:
        "Complex multi-filter historical query across three sources (July 28-29, 2025)",
      category: "Multi-Source Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_filter: {
              custom: {
                start_datetime: "2025-07-28T12:30:00Z",
                end_datetime: "2025-07-29T18:45:00Z",
              },
            },
            raw_contains: ["timeout"],
            level: "WARN",
          },
          sources: ["1386515", "1442440", "1386535"],
          limit: 200,
        },
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query_logs",
          arguments: {
            filters: {
              time_filter: {
                custom: {
                  start_datetime: "2025-07-28T12:30:00Z",
                  end_datetime: "2025-07-29T18:45:00Z",
                },
              },
              raw_contains: ["timeout"],
              level: "WARN",
            },
            sources: ["1386515", "1442440", "1386535"],
            limit: 200,
          },
        },
        id: 32,
      },
      expected: {
        shouldContain: [
          "Query Results",
          "Sources queried:",
          "Spark - Production",
          "Spark Cron - Production", 
          "App - production",
          "api_used: \"multi-source-optimized\""
        ],
        shouldNotContain: ["remote(", "Failed to query source"],
        resultCount: { max: 200 },
        notes:
          "Should use historical s3Cluster queries across all three sources with complex filtering, executed sequentially",
      },
      mockData: [
        {
          dt: "2025-07-28T13:00:00Z",
          raw: "WARN: Database connection timeout detected in production environment",
        },
        {
          dt: "2025-07-28T15:30:00Z",
          raw: "WARN: API request timeout - external service slow to respond",
        },
        {
          dt: "2025-07-29T17:45:00Z",
          raw: "WARN: Cache timeout occurred during high traffic period",
        },
      ],
    },
  },

  "source-group-log-querying": {
    "basic-source-group-query": {
      id: "4.1",
      description: "Basic log query using source group",
      category: "Source Group Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          source_group: "Production",
          limit: 5,
        },
      },
      expected: {
        shouldContain: ["Query Results", "dt:", "raw:"],
        resultCount: { max: 5 },
        notes: "Should return recent logs from all sources in Production group",
      },
      mockData: [
        { dt: "2024-01-01T10:00:00Z", raw: "Production group log entry 1" },
        { dt: "2024-01-01T10:01:00Z", raw: "Production group log entry 2" },
      ],
    },
    "source-group-content-search": {
      id: "4.2",
      description: "Search logs in source group by content",
      category: "Source Group Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: ["warning"],
          },
          source_group: "Production",
          limit: 10,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should return warning logs from all Production group sources",
      },
      mockData: [
        {
          dt: "2024-01-01T10:00:00Z",
          raw: "WARNING: High memory usage in production",
        },
        {
          dt: "2024-01-01T10:01:00Z",
          raw: "WARNING: Slow query detected in production",
        },
      ],
    },
    "source-group-level-filtering": {
      id: "4.3",
      description: "Filter logs in source group by level",
      category: "Source Group Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            level: "ERROR",
          },
          source_group: "Production",
          limit: 12,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 12 },
        notes:
          "Should return ERROR level logs from all Production group sources",
      },
      mockData: [
        {
          dt: "2024-01-01T10:00:00Z",
          raw: '{"level":"error","message":"Production error detected"}',
        },
      ],
    },
    "source-group-historical-errors": {
      id: "4.4",
      description: "Historical source group query for ERROR logs (July 25-26, 2025)",
      category: "Source Group Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_filter: {
              custom: {
                start_datetime: "2025-07-25T00:00:00Z",
                end_datetime: "2025-07-26T23:59:59Z",
              },
            },
            level: "ERROR",
          },
          source_group: "Production",
          limit: 50,
        },
      },
      jsonRpcPayload: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query_logs",
          arguments: {
            filters: {
              time_filter: {
                custom: {
                  start_datetime: "2025-07-25T00:00:00Z",
                  end_datetime: "2025-07-26T23:59:59Z",
                },
              },
              level: "ERROR",
            },
            source_group: "Production",
            limit: 50,
          },
        },
        id: 44,
      },
      expected: {
        shouldContain: [
          "Query Results",
          "Sources queried:",
          "api_used: \"multi-source-optimized\"",
        ],
        shouldNotContain: ["remote(", "Failed to query source"],
        resultCount: { max: 50 },
        notes:
          "Should use historical s3Cluster queries for Production group sources with ERROR level filtering",
      },
      mockData: [
        {
          dt: "2025-07-25T10:30:00Z",
          raw: 'ERROR: Production database connection failed',
        },
        {
          dt: "2025-07-25T14:45:00Z",
          raw: 'ERROR: Production API timeout in authentication service',
        },
        {
          dt: "2025-07-26T18:15:00Z",
          raw: 'ERROR: Production cache service unavailable',
        },
      ],
    },
  },

  "output-formats": {
    "default-jsonrows": {
      id: "5.1",
      description: "Default JSONEachRow format (always used)",
      category: "Output Format Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        format: "JSONEachRow",
        resultCount: { max: 5 },
        notes: "Should always return data in JSONEachRow format",
      },
      mockData: [
        { dt: "2024-01-01T10:00:00Z", raw: "Test log 1" },
        { dt: "2024-01-01T10:01:00Z", raw: "Test log 2" },
      ],
    },
  },

  "debug-tools": {
    "debug-table-info": {
      id: "6.1",
      description: "Debug table information and schema",
      category: "Debug Tools Tests",
      payload: {
        name: "debug_table_info",
        arguments: {
          sources: ["1386515"],
        },
      },
      expected: {
        shouldContain: [
          "Debug Information",
          "Resolved Sources",
          "Available Columns",
        ],
        notes: "Should show table schema and query generation info",
      },
      mockData: [],
    },
  },

  "limit-testing": {
    "small-limit": {
      id: "7.1",
      description: "Small limit test",
      category: "Limit Testing",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 1,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 1 },
        notes: "Should return exactly 1 log entry",
      },
      mockData: [{ dt: "2024-01-01T10:00:00Z", raw: "Single log entry" }],
    },
    "large-limit": {
      id: "7.2",
      description: "Large limit test",
      category: "Limit Testing",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 100,
        },
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 100 },
        notes: "Should return up to 100 log entries",
      },
      mockData: Array.from({ length: 50 }, (_, i) => ({
        dt: `2024-01-01T10:${i.toString().padStart(2, "0")}:00Z`,
        raw: `Log entry ${i + 1}`,
      })),
    },
  },
};

// Helper functions for working with test cases
export function getAllTestCases(): ManualTestCase[] {
  const allTests: ManualTestCase[] = [];

  for (const [categoryKey, category] of Object.entries(manualTestCases)) {
    for (const [testKey, testCase] of Object.entries(category)) {
      allTests.push(testCase);
    }
  }

  return allTests;
}

export function getTestsByCategory(categoryKey: string): ManualTestCase[] {
  const category = manualTestCases[categoryKey];
  if (!category) {
    return [];
  }

  return Object.values(category);
}

export function getTestCase(
  categoryKey: string,
  testKey: string
): ManualTestCase | null {
  const category = manualTestCases[categoryKey];
  if (!category) {
    return null;
  }

  return category[testKey] || null;
}

export function getTestCaseById(id: string): ManualTestCase | null {
  for (const category of Object.values(manualTestCases)) {
    for (const testCase of Object.values(category)) {
      if (testCase.id === id) {
        return testCase;
      }
    }
  }
  return null;
}

export const testCategories = Object.keys(manualTestCases);
