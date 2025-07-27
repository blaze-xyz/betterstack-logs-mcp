import { describe, it, expect } from 'vitest'

// Import the actual structured query functions for direct testing
import {
  buildStructuredQuery,
  validateQueryParams,
  sanitizeSqlString,
  validateJsonFieldFilter,
  parseRelativeTime,
  parseTimeValue,
  type StructuredQueryParams
} from '../../src/tools/query-tools.js'

describe('buildStructuredQuery Function (Simplified Schema)', () => {
  describe('Basic Query Generation', () => {
    it('should generate basic query with default parameters', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10')
    })

    it('should handle multiple fields in SELECT clause', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw', 'json'],
        limit: 5
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw, json FROM logs ORDER BY dt DESC LIMIT 5')
    })

    it('should handle single field selection', async () => {
      const params: StructuredQueryParams = {
        fields: ['raw'],
        limit: 1
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT raw FROM logs ORDER BY dt DESC LIMIT 1')
    })
  })

  describe('JSON Fields Extraction', () => {
    it('should generate getJSON calls for json fields', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        jsonFields: [
          { path: 'level' },
          { path: 'message', alias: 'msg' }
        ],
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw, getJSON(raw, 'level') as level, getJSON(raw, 'message') as msg FROM logs ORDER BY dt DESC LIMIT 10")
    })

    it('should use default alias when not provided', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt'],
        jsonFields: [
          { path: 'user.id' },
          { path: 'request.method' }
        ],
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, getJSON(raw, 'user.id') as user_id, getJSON(raw, 'request.method') as request_method FROM logs ORDER BY dt DESC LIMIT 10")
    })

    it('should handle complex nested JSON paths', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt'],
        jsonFields: [
          { path: 'context.user.session.id', alias: 'session_id' },
          { path: 'metadata.client.version' }
        ],
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, getJSON(raw, 'context.user.session.id') as session_id, getJSON(raw, 'metadata.client.version') as metadata_client_version FROM logs ORDER BY dt DESC LIMIT 10")
    })
  })

  describe('Raw Log Filtering', () => {
    it('should generate raw_contains filter', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          raw_contains: 'error'
        },
        limit: 20
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE raw LIKE '%error%' ORDER BY dt DESC LIMIT 20")
    })

  })

  describe('Level Filtering (JSON-based)', () => {
    it('should generate level filter using getJSON', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          level: 'ERROR'
        },
        limit: 50
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE getJSON(raw, 'level') = 'ERROR' ORDER BY dt DESC LIMIT 50")
    })

    it('should handle all valid log levels', async () => {
      const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
      
      for (const level of levels) {
        const params: StructuredQueryParams = {
          fields: ['dt', 'raw'],
          filters: { level: level as any },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe(`SELECT dt, raw FROM logs WHERE getJSON(raw, 'level') = '${level}' ORDER BY dt DESC LIMIT 10`)
      }
    })
  })

  describe('Time Range Filtering', () => {
    it('should generate relative time filter (compact format)', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          time_range: {
            last: '1h'
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 1 HOUR ORDER BY dt DESC LIMIT 10')
    })

    it('should generate relative time filter (natural language)', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          time_range: {
            last: '30 minutes'
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 30 MINUTE ORDER BY dt DESC LIMIT 10')
    })

    it('should generate absolute time range filters', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          time_range: {
            start: '2024-01-15',
            end: '2024-01-16'
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= '2024-01-15' AND dt <= '2024-01-16' ORDER BY dt DESC LIMIT 10")
    })
  })

  describe('JSON Field Filtering', () => {
    it('should generate JSON field filter using getJSON', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          json_field: {
            path: 'user.id',
            value: '12345'
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE getJSON(raw, 'user.id') = '12345' ORDER BY dt DESC LIMIT 10")
    })

    it('should handle complex JSON field paths', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          json_field: {
            path: 'metadata.request.headers.user_agent',
            value: 'Mozilla/5.0'
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE getJSON(raw, 'metadata.request.headers.user_agent') = 'Mozilla/5.0' ORDER BY dt DESC LIMIT 10")
    })
  })

  describe('Multiple Filters', () => {
    it('should combine multiple filters with AND', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          raw_contains: 'api',
          level: 'ERROR',
          time_range: {
            last: '1h'
          }
        },
        limit: 25
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE raw LIKE '%api%' AND getJSON(raw, 'level') = 'ERROR' AND dt >= now() - INTERVAL 1 HOUR ORDER BY dt DESC LIMIT 25")
    })

    it('should handle all filter types together', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        filters: {
          raw_contains: 'payment',
          level: 'INFO',
          json_field: {
            path: 'transaction.type',
            value: 'credit_card'
          },
          time_range: {
            last: '2d'
          }
        },
        limit: 100
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE raw LIKE '%payment%' AND getJSON(raw, 'level') = 'INFO' AND dt >= now() - INTERVAL 2 DAY AND getJSON(raw, 'transaction.type') = 'credit_card' ORDER BY dt DESC LIMIT 100")
    })
  })

  describe('Complex Scenarios', () => {
    it('should combine JSON fields extraction with filtering', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw'],
        jsonFields: [
          { path: 'user.id', alias: 'user_id' },
          { path: 'request.method' },
          { path: 'response.status_code', alias: 'status' }
        ],
        filters: {
          level: 'ERROR',
          json_field: {
            path: 'service.name',
            value: 'payment-api'
          },
          time_range: {
            last: '4h'
          }
        },
        limit: 50
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw, getJSON(raw, 'user.id') as user_id, getJSON(raw, 'request.method') as request_method, getJSON(raw, 'response.status_code') as status FROM logs WHERE getJSON(raw, 'level') = 'ERROR' AND dt >= now() - INTERVAL 4 HOUR AND getJSON(raw, 'service.name') = 'payment-api' ORDER BY dt DESC LIMIT 50")
    })

    it('should handle no filters (fields and ordering only)', async () => {
      const params: StructuredQueryParams = {
        fields: ['dt', 'raw', 'json'],
        jsonFields: [
          { path: 'level' }
        ],
        limit: 5
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw, json, getJSON(raw, 'level') as level FROM logs ORDER BY dt DESC LIMIT 5")
    })
  })
})

describe('validateQueryParams Function (Simplified)', () => {
  it('should validate valid parameters', () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'raw'],
      limit: 10
    }

    expect(() => validateQueryParams(params)).not.toThrow()
  })

  it('should reject invalid fields', () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'invalid_field'],
      limit: 10
    }

    expect(() => validateQueryParams(params)).toThrow('Invalid fields: invalid_field')
  })

  it('should reject invalid limit (too low)', () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'raw'],
      limit: 0
    }

    expect(() => validateQueryParams(params)).toThrow('Invalid limit: 0. Must be between 1 and 1000')
  })

  it('should reject invalid limit (too high)', () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'raw'],
      limit: 1001
    }

    expect(() => validateQueryParams(params)).toThrow('Invalid limit: 1001. Must be between 1 and 1000')
  })
})

describe('Other Helper Functions (Unchanged)', () => {
  describe('sanitizeSqlString Function', () => {
    it('should escape single quotes', () => {
      expect(sanitizeSqlString("test'value")).toBe("test''value")
    })

    it('should handle multiple single quotes', () => {
      expect(sanitizeSqlString("user's 'special' data")).toBe("user''s ''special'' data")
    })

    it('should handle SQL injection attempts', () => {
      const maliciousInput = "'; DROP TABLE logs; --"
      const sanitized = sanitizeSqlString(maliciousInput)
      expect(sanitized).toBe("''; DROP TABLE logs; --")
      expect(sanitized).not.toMatch(/^[^']*'[^']*;/)
    })
  })

  describe('validateJsonFieldFilter Function', () => {
    it('should validate valid JSON field filter', () => {
      const jsonField = { path: 'user.id', value: '12345' }
      expect(() => validateJsonFieldFilter(jsonField)).not.toThrow()
    })

    it('should reject invalid path format', () => {
      const jsonField = { path: '.invalid', value: '12345' }
      expect(() => validateJsonFieldFilter(jsonField)).toThrow('Invalid JSON path format')
    })
  })

  describe('parseRelativeTime Function', () => {
    it('should parse compact format', () => {
      expect(parseRelativeTime('1h')).toBe('dt >= now() - INTERVAL 1 HOUR')
      expect(parseRelativeTime('30m')).toBe('dt >= now() - INTERVAL 30 MINUTE')
      expect(parseRelativeTime('2d')).toBe('dt >= now() - INTERVAL 2 DAY')
    })

    it('should parse natural language format', () => {
      expect(parseRelativeTime('1 hour')).toBe('dt >= now() - INTERVAL 1 HOUR')
      expect(parseRelativeTime('30 minutes')).toBe('dt >= now() - INTERVAL 30 MINUTE')
    })

    it('should return null for invalid formats', () => {
      expect(parseRelativeTime('invalid')).toBeNull()
      expect(parseRelativeTime('1x')).toBeNull()
    })
  })

  describe('parseTimeValue Function', () => {
    it('should parse ISO date format', () => {
      expect(parseTimeValue('2024-01-15', 'start')).toBe("dt >= '2024-01-15'")
      expect(parseTimeValue('2024-01-15', 'end')).toBe("dt <= '2024-01-15'")
    })

    it('should return null for invalid formats', () => {
      expect(parseTimeValue('invalid-date', 'start')).toBeNull()
      expect(parseTimeValue('not-a-date', 'end')).toBeNull()
    })

    it('should accept format-valid dates (semantic validation is database responsibility)', () => {
      expect(parseTimeValue('2024-13-01', 'start')).toBe("dt >= '2024-13-01'")
    })
  })
})

describe('Error Conditions and Edge Cases', () => {
  it('should throw error for invalid log level', async () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'raw'],
      filters: {
        level: 'INVALID_LEVEL' as any
      },
      limit: 10
    }

    await expect(buildStructuredQuery(params)).rejects.toThrow('Invalid log level: INVALID_LEVEL')
  })


  it('should handle edge case limits', async () => {
    // Test minimum limit
    const params1: StructuredQueryParams = {
      fields: ['dt'],
      limit: 1
    }
    const query1 = await buildStructuredQuery(params1)
    expect(query1).toBe('SELECT dt FROM logs ORDER BY dt DESC LIMIT 1')

    // Test maximum limit
    const params2: StructuredQueryParams = {
      fields: ['dt'],
      limit: 1000
    }
    const query2 = await buildStructuredQuery(params2)
    expect(query2).toBe('SELECT dt FROM logs ORDER BY dt DESC LIMIT 1000')
  })

  it('should handle special characters in filter values', async () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'raw'],
      filters: {
        raw_contains: "user's data with \"quotes\" and \nnewlines"
      },
      limit: 10
    }

    const query = await buildStructuredQuery(params)
    expect(query).toContain("raw LIKE '%user''s data with \"quotes\" and \nnewlines%'")
  })
})