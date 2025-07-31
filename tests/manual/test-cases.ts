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
  id: string
  description: string
  category: string
  payload: {
    name: string
    arguments: Record<string, any>
  }
  expected: {
    shouldContain?: string[]
    shouldNotContain?: string[]
    format?: string
    resultCount?: number | { min?: number; max?: number }
    notes?: string
  }
  mockData?: any[]
}

export interface TestCategory {
  [testKey: string]: ManualTestCase
}

export interface ManualTestSuite {
  [categoryKey: string]: TestCategory
}

export const manualTestCases: ManualTestSuite = {
  "source-management": {
    "list-sources": {
      id: "1.1",
      description: "List all available log sources",
      category: "Source Management Tests",
      payload: {
        name: "list_sources",
        arguments: {}
      },
      expected: {
        shouldContain: ["Available Log Sources", "ID:"],
        resultCount: { min: 1 },
        notes: "Should return at least one configured source"
      },
      mockData: [
        { id: '1386515', name: 'Test Source', platform: 'ubuntu', retention_days: 30 }
      ]
    },
    "list-source-groups": {
      id: "1.2",
      description: "List all source groups",
      category: "Source Management Tests",
      payload: {
        name: "list_source_groups",
        arguments: {}
      },
      expected: {
        shouldContain: ["Source Groups"],
        notes: "May return empty if no groups configured or if team token needed"
      },
      mockData: [
        { id: 'group1', name: 'Production Logs', source_ids: ['1386515'] }
      ]
    },
    "get-source-info": {
      id: "1.3",
      description: "Get detailed information about a specific source",
      category: "Source Management Tests",
      payload: {
        name: "get_source_info",
        arguments: {
          source_id: "1386515"
        }
      },
      expected: {
        shouldContain: ["Source:", "ID:", "Platform:"],
        notes: "Should return detailed source information"
      },
      mockData: [
        { id: '1386515', name: 'Test Source', platform: 'ubuntu' }
      ]
    },
    "get-source-group-info": {
      id: "1.4",
      description: "Get detailed information about a source group",
      category: "Source Management Tests",
      payload: {
        name: "get_source_group_info",
        arguments: {
          group_name: "Production Logs"
        }
      },
      expected: {
        shouldContain: ["Source Group:", "Total Sources:", "Included Sources"],
        notes: "Should return detailed source group information"
      },
      mockData: [
        { id: 'group1', name: 'Production Logs', source_ids: ['1386515'] }
      ]
    },
    "test-connection": {
      id: "1.5",
      description: "Test connection to BetterStack APIs",
      category: "Source Management Tests",
      payload: {
        name: "test_connection",
        arguments: {}
      },
      expected: {
        shouldContain: ["Connection"],
        notes: "Should verify both Telemetry API and ClickHouse connectivity"
      },
      mockData: []
    }
  },

  "log-querying": {
    "basic-query": {
      id: "2.1",
      description: "Basic log query without filters",
      category: "Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5
        }
      },
      expected: {
        shouldContain: ["Query Results", "dt:", "raw:"],
        resultCount: { max: 5 },
        notes: "Should return recent logs with timestamp and raw message"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log entry 1' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Test log entry 2' }
      ]
    },
    "raw-content-search": {
      id: "2.2",
      description: "Search logs by raw content substring",
      category: "Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: "error"
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should return logs containing 'error' substring (case-insensitive)"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'ERROR: Database connection failed' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Application error in authentication' }
      ]
    },
    "level-filtering": {
      id: "2.3",
      description: "Filter logs by level",
      category: "Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            level: "ERROR"
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should return logs with ERROR level using pattern matching"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: '{"level":"error","message":"Database failed"}' }
      ]
    },
    "time-filtering-relative": {
      id: "2.4",
      description: "Filter logs by relative time range",
      category: "Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_filter: {
              relative: "last_30_minutes"
            }
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should return logs from last 30 minutes only"
      },
      mockData: [
        { dt: '2024-01-01T10:45:00Z', raw: 'Recent log entry' }
      ]
    },
    "time-filtering-custom": {
      id: "2.5",
      description: "Filter logs by custom time range",
      category: "Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_filter: {
              custom: {
                start_datetime: "2025-07-30T10:00:00Z",
                end_datetime: "2025-07-30T12:00:00Z"
              }
            }
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should return logs within specified custom time range"
      },
      mockData: [
        { dt: '2025-07-30T10:30:00Z', raw: 'Log within custom time range' }
      ]
    },
    "combined-filters": {
      id: "2.6",
      description: "Combine multiple filters",
      category: "Log Querying Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: "login",
            level: "ERROR",
            time_filter: {
              relative: "last_24_hours"
            }
          },
          sources: ["1386515"],
          limit: 15
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 15 },
        notes: "Should return ERROR level logs containing 'login' from last 24h"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'ERROR: Login failed for user' }
      ]
    }
  },

  "output-formats": {
    "default-jsonrows": {
      id: "3.1",
      description: "Default JSONEachRow format",
      category: "Output Format Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5,
          format: "JSONEachRow"
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        format: "JSONEachRow",
        resultCount: { max: 5 },
        notes: "Should return data in JSONEachRow format (default)"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Test log 2' }
      ]
    },
    "pretty-format": {
      id: "3.2",
      description: "Pretty format for human reading",
      category: "Output Format Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5,
          format: "Pretty"
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        format: "Pretty",
        resultCount: { max: 5 },
        notes: "Should return human-readable table format"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1' }
      ]
    },
    "csv-format": {
      id: "3.3",
      description: "CSV format for data export",
      category: "Output Format Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5,
          format: "CSV"
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        format: "CSV",
        resultCount: { max: 5 },
        notes: "Should return comma-separated values"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1' }
      ]
    },
    "json-format": {
      id: "3.4",
      description: "JSON format (single object)",
      category: "Output Format Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5,
          format: "JSON"
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        format: "JSON",
        resultCount: { max: 5 },
        notes: "Should return single JSON object with array of results"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1' }
      ]
    },
    "tsv-format": {
      id: "3.5",
      description: "TSV format for spreadsheet import",
      category: "Output Format Tests",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5,
          format: "TSV"
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        format: "TSV",
        resultCount: { max: 5 },
        notes: "Should return tab-separated values"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1' }
      ]
    }
  },

  "debug-tools": {
    "debug-table-info": {
      id: "4.1",
      description: "Debug table information and schema",
      category: "Debug Tools Tests",
      payload: {
        name: "debug_table_info",
        arguments: {
          sources: ["1386515"]
        }
      },
      expected: {
        shouldContain: ["Debug Information", "Resolved Sources", "Available Columns"],
        notes: "Should show table schema and query generation info"
      },
      mockData: []
    }
  },

  "limit-testing": {
    "small-limit": {
      id: "5.1",
      description: "Small limit test",
      category: "Limit Testing",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 1
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 1 },
        notes: "Should return exactly 1 log entry"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Single log entry' }
      ]
    },
    "large-limit": {
      id: "5.2",
      description: "Large limit test",
      category: "Limit Testing",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 100
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 100 },
        notes: "Should return up to 100 log entries"
      },
      mockData: Array.from({ length: 50 }, (_, i) => ({
        dt: `2024-01-01T10:${i.toString().padStart(2, '0')}:00Z`,
        raw: `Log entry ${i + 1}`
      }))
    }
  }
}

// Helper functions for working with test cases
export function getAllTestCases(): ManualTestCase[] {
  const allTests: ManualTestCase[] = []
  
  for (const [categoryKey, category] of Object.entries(manualTestCases)) {
    for (const [testKey, testCase] of Object.entries(category)) {
      allTests.push(testCase)
    }
  }
  
  return allTests
}

export function getTestsByCategory(categoryKey: string): ManualTestCase[] {
  const category = manualTestCases[categoryKey]
  if (!category) {
    return []
  }
  
  return Object.values(category)
}

export function getTestCase(categoryKey: string, testKey: string): ManualTestCase | null {
  const category = manualTestCases[categoryKey]
  if (!category) {
    return null
  }
  
  return category[testKey] || null
}

export function getTestCaseById(id: string): ManualTestCase | null {
  for (const category of Object.values(manualTestCases)) {
    for (const testCase of Object.values(category)) {
      if (testCase.id === id) {
        return testCase
      }
    }
  }
  return null
}

export const testCategories = Object.keys(manualTestCases)