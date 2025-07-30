/**
 * Manual Test Cases - Structured test definitions for semi-automated testing
 * 
 * This file contains all test cases from the manual testing checklist in a structured format
 * that can be executed programmatically while maintaining human readability.
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
  "json-field-extraction": {
    "extract-default-alias": {
      id: "1.1",
      description: "Extract JSON field with default alias",
      category: "JSON Field Extraction Tests",
      payload: {
        name: "query_logs",
        arguments: {
          json_fields: [{ path: "level" }],
          sources: ["1386515"],
          limit: 5
        }
      },
      expected: {
        shouldContain: ["level field", "Query Results"],
        format: "JSONEachRow",
        resultCount: { max: 5 }
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'INFO: Application started', level: 'INFO' },
        { dt: '2024-01-01T10:01:00Z', raw: 'ERROR: Database connection failed', level: 'ERROR' },
        { dt: '2024-01-01T10:02:00Z', raw: 'WARN: High memory usage detected', level: 'WARN' }
      ]
    },
    "extract-custom-alias": {
      id: "1.2",
      description: "Extract JSON field with custom alias",
      category: "JSON Field Extraction Tests",
      payload: {
        name: "query_logs",
        arguments: {
          json_fields: [{ path: "level", alias: "log_level" }],
          sources: ["1386515"],
          limit: 5
        }
      },
      expected: {
        shouldContain: ["log_level", "Query Results"],
        format: "JSONEachRow",
        resultCount: { max: 5 }
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'INFO: Application started', level: 'INFO' },
        { dt: '2024-01-01T10:01:00Z', raw: 'ERROR: Database connection failed', level: 'ERROR' }
      ]
    },
    "extract-multiple-nested": {
      id: "1.3",
      description: "Extract multiple nested JSON fields",
      category: "JSON Field Extraction Tests",
      payload: {
        name: "query_logs",
        arguments: {
          json_fields: [
            { path: "level", alias: "log_level" },
            { path: "message", alias: "msg" },
            { path: "context.hostname", alias: "host" },
            { path: "user.id", alias: "user_id" }
          ],
          sources: ["1386515"],
          limit: 5
        }
      },
      expected: {
        shouldContain: ["log_level", "msg", "host", "user_id", "Query Results"],
        format: "JSONEachRow",
        resultCount: { max: 5 }
      },
      mockData: [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: 'User login successful', 
          level: 'INFO',
          message: 'User login successful',
          context: { hostname: 'web-server-01' },
          user: { id: 12345 }
        }
      ]
    }
  },

  "raw-content-filtering": {
    "simple-substring-search": {
      id: "2.1",
      description: "Simple substring search",
      category: "Raw Content Filtering Tests",
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
        shouldContain: ["error", "Query Results"],
        resultCount: { max: 10 }
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'ERROR: Database connection failed', level: 'ERROR' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Application error in user authentication', level: 'ERROR' }
      ]
    },
    "specific-pattern-search": {
      id: "2.2",
      description: "Search for specific patterns",
      category: "Raw Content Filtering Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: "HTTP 500"
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["HTTP 500", "Query Results"],
        resultCount: { max: 10 }
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'HTTP 500 Internal Server Error on /api/users', level: 'ERROR' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Returned HTTP 500 due to database timeout', level: 'ERROR' }
      ]
    }
  },

  "log-level-filtering": {
    "filter-error-level": {
      id: "3.1",
      description: "Filter by ERROR level",
      category: "Log Level Filtering Tests",
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
        shouldContain: ["ERROR", "Query Results"],
        resultCount: { max: 10 }
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: '{"level":"ERROR","message":"Database connection failed","timestamp":"2024-01-01T10:00:00Z"}', level: 'ERROR' },
        { dt: '2024-01-01T10:01:00Z', raw: 'ERROR: Authentication failed for user', level: 'ERROR' },
        { dt: '2024-01-01T10:02:00Z', raw: '[ERROR] Invalid API key provided', level: 'ERROR' },
        { dt: '2024-01-01T10:03:00Z', raw: 'level=ERROR Failed to process payment', level: 'ERROR' }
      ]
    },
    "filter-info-level": {
      id: "3.2",
      description: "Filter by INFO level",
      category: "Log Level Filtering Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            level: "INFO"
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["INFO", "Query Results"],
        resultCount: { max: 10 }
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: '{"level": "INFO", "message": "Application started successfully"}', level: 'INFO' },
        { dt: '2024-01-01T10:01:00Z', raw: 'INFO: User logged in successfully', level: 'INFO' },
        { dt: '2024-01-01T10:02:00Z', raw: '\tINFO\tRequest processed successfully', level: 'INFO' },
        { dt: '2024-01-01T10:03:00Z', raw: 'Cache miss for key user:123\nINFO', level: 'INFO' }
      ]
    },
    "filter-warn-level": {
      id: "3.3",
      description: "Filter by WARN level",
      category: "Log Level Filtering Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            level: "WARN"
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["WARN", "Query Results"],
        resultCount: { max: 10 }
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: '{"level":"WARN","message":"High memory usage detected","memory_usage":"85%"}', level: 'WARN' },
        { dt: '2024-01-01T10:01:00Z', raw: 'WARN: Slow database query detected', level: 'WARN' },
        { dt: '2024-01-01T10:02:00Z', raw: '[WARN] Connection pool nearly exhausted', level: 'WARN' },
        { dt: '2024-01-01T10:03:00Z', raw: ' WARN Rate limit approaching for API key', level: 'WARN' }
      ]
    }
  },

  "time-range-filtering": {
    "last-hour": {
      id: "4.1",
      description: "Last hour",
      category: "Time Range Filtering Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_range: {
              last: "1h"
            }
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should only return logs from the last hour"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Recent log entry 1', level: 'INFO' },
        { dt: '2024-01-01T10:30:00Z', raw: 'Recent log entry 2', level: 'INFO' }
      ]
    },
    "last-30-minutes": {
      id: "4.2",
      description: "Last 30 minutes",
      category: "Time Range Filtering Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_range: {
              last: "30m"
            }
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should only return logs from the last 30 minutes"
      },
      mockData: [
        { dt: '2024-01-01T10:45:00Z', raw: 'Very recent log entry', level: 'INFO' }
      ]
    },
    "specific-time-range": {
      id: "4.3",
      description: "Specific time range with start and end",
      category: "Time Range Filtering Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_range: {
              start: "2024-01-15T10:00:00",
              end: "2024-01-15T12:00:00"
            }
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should only return logs between specified start and end times"
      },
      mockData: [
        { dt: '2024-01-15T10:30:00Z', raw: 'Log within time range', level: 'INFO' },
        { dt: '2024-01-15T11:00:00Z', raw: 'Another log within range', level: 'INFO' }
      ]
    },
    "iso-timestamps": {
      id: "4.4",
      description: "Start and end with ISO timestamps",
      category: "Time Range Filtering Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_range: {
              start: "2025-07-28T10:00:00Z",
              end: "2025-07-28T12:00:00Z"
            }
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should handle ISO timestamp format correctly"
      },
      mockData: [
        { dt: '2025-07-28T10:30:00Z', raw: 'Log with ISO timestamp', level: 'INFO' }
      ]
    },
    "relative-start-time": {
      id: "4.5",
      description: "Relative start time",
      category: "Time Range Filtering Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            time_range: {
              start: "2 hours ago"
            }
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        resultCount: { max: 10 },
        notes: "Should handle relative time expressions"
      },
      mockData: [
        { dt: '2024-01-01T08:00:00Z', raw: 'Log from 2 hours ago', level: 'INFO' },
        { dt: '2024-01-01T09:00:00Z', raw: 'Log from 1 hour ago', level: 'INFO' }
      ]
    }
  },

  "combined-filters": {
    "multiple-filters": {
      id: "5.1",
      description: "Multiple filters combined",
      category: "Combined Filter Tests",
      payload: {
        name: "query_logs",
        arguments: {
          filters: {
            raw_contains: "error",
            level: "ERROR",
            time_range: {
              last: "1h"
            }
          },
          sources: ["1386515"],
          limit: 10
        }
      },
      expected: {
        shouldContain: ["error", "ERROR", "Query Results"],
        resultCount: { max: 10 },
        notes: "Should combine all filters - recent ERROR logs containing 'error'"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: '{"level":"ERROR","message":"Database error occurred","error_code":"DB001"}', level: 'ERROR' },
        { dt: '2024-01-01T10:01:00Z', raw: 'ERROR: Connection error to database', level: 'ERROR' },
        { dt: '2024-01-01T10:02:00Z', raw: '[ERROR] Authentication error for user login', level: 'ERROR' }
      ]
    },
    "level-time-json": {
      id: "5.2",
      description: "Level + time range + JSON extraction",
      category: "Combined Filter Tests",
      payload: {
        name: "query_logs",
        arguments: {
          json_fields: [
            { path: "user.id", alias: "user" },
            { path: "request.duration", alias: "duration" }
          ],
          filters: {
            level: "INFO",
            time_range: {
              last: "30m"
            }
          },
          sources: ["1386515"],
          limit: 15
        }
      },
      expected: {
        shouldContain: ["user", "duration", "INFO", "Query Results"],
        resultCount: { max: 15 },
        notes: "Should combine filtering with JSON field extraction"
      },
      mockData: [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: '{"level": "INFO", "message": "Request processed successfully", "user": {"id": 123}, "request": {"duration": 250}}', 
          level: 'INFO',
          user: { id: 123 },
          request: { duration: 250 }
        },
        { 
          dt: '2024-01-01T10:01:00Z', 
          raw: 'INFO: API call completed in 180ms\n{"user":{"id":456},"request":{"duration":180}}', 
          level: 'INFO',
          user: { id: 456 },
          request: { duration: 180 }
        }
      ]
    }
  },

  "limit-testing": {
    "small-limit": {
      id: "6.1",
      description: "Small limit",
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
        { dt: '2024-01-01T10:00:00Z', raw: 'Single log entry', level: 'INFO' }
      ]
    },
    "large-limit": {
      id: "6.2",
      description: "Large limit",
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
        raw: `Log entry ${i + 1}`,
        level: 'INFO'
      }))
    }
  },

  "complex-scenarios": {
    "debug-login-issues": {
      id: "7.1",
      description: "Debug login issues",
      category: "Complex Real-World Scenarios",
      payload: {
        name: "query_logs",
        arguments: {
          json_fields: [
            { path: "user.email", alias: "user_email" },
            { path: "request.ip", alias: "ip_address" }
          ],
          filters: {
            raw_contains: "login",
            level: "ERROR",
            time_range: {
              last: "24h"
            }
          },
          sources: ["1386515"],
          limit: 20
        }
      },
      expected: {
        shouldContain: ["user_email", "ip_address", "login", "ERROR", "Query Results"],
        resultCount: { max: 20 },
        notes: "Should extract user info from login-related errors"
      },
      mockData: [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: 'Login failed for user', 
          level: 'ERROR',
          user: { email: 'user@example.com' },
          request: { ip: '192.168.1.100' }
        }
      ]
    },
    "monitor-api-performance": {
      id: "7.2",
      description: "Monitor API performance",
      category: "Complex Real-World Scenarios",
      payload: {
        name: "query_logs",
        arguments: {
          json_fields: [
            { path: "request.method", alias: "method" },
            { path: "request.duration", alias: "duration_ms" },
            { path: "response.status", alias: "status" }
          ],
          filters: {
            raw_contains: "API",
            time_range: {
              last: "2h"
            }
          },
          sources: ["1386515"],
          limit: 50
        }
      },
      expected: {
        shouldContain: ["method", "duration_ms", "status", "API", "Query Results"],
        resultCount: { max: 50 },
        notes: "Should extract performance metrics from API logs"
      },
      mockData: [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: 'API request completed', 
          level: 'INFO',
          request: { method: 'GET', duration: 125 },
          response: { status: 200 }
        }
      ]
    }
  },

  "output-formats": {
    "default-jsonrows": {
      id: "8.1",
      description: "Default JSONEachRow format",
      category: "Output Format Testing",
      payload: {
        name: "query_logs",
        arguments: {
          sources: ["1386515"],
          limit: 5
        }
      },
      expected: {
        shouldContain: ["Query Results"],
        format: "JSONEachRow",
        resultCount: { max: 5 },
        notes: "Should return data in JSONEachRow format (array of objects)"
      },
      mockData: [
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1', level: 'INFO' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Test log 2', level: 'INFO' }
      ]
    },
    "pretty-format": {
      id: "8.2",
      description: "Pretty format for human reading",
      category: "Output Format Testing",
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
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1', level: 'INFO' }
      ]
    },
    "csv-format": {
      id: "8.3",
      description: "CSV format for data export",
      category: "Output Format Testing",
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
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1', level: 'INFO' }
      ]
    },
    "json-format": {
      id: "8.4",
      description: "JSON format (single object)",
      category: "Output Format Testing",
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
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1', level: 'INFO' }
      ]
    },
    "tsv-format": {
      id: "8.5",
      description: "TSV format for spreadsheet import",
      category: "Output Format Testing",
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
        { dt: '2024-01-01T10:00:00Z', raw: 'Test log 1', level: 'INFO' }
      ]
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