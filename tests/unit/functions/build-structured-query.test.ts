import { describe, it, expect } from 'vitest'
import { buildStructuredQuery, type StructuredQueryParams } from '../../../src/tools/query-tools.js'

describe('buildStructuredQuery Function', () => {
  describe('Basic Query Generation', () => {
    it('should generate basic query with default dt,raw fields', async () => {
      const params: StructuredQueryParams = {
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
    })

    it('should always use dt,raw fields regardless of other parameters', async () => {
      const params: StructuredQueryParams = {
        limit: 5
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 5 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
    })
  })


  describe('Raw Log Filtering', () => {
    it('should generate raw_contains filter', async () => {
      const params: StructuredQueryParams = {
        filters: {
          raw_contains: 'error'
        },
        limit: 20
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%error%') ORDER BY dt DESC LIMIT 20 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should use case-insensitive ILIKE for raw_contains filter', async () => {
      const params: StructuredQueryParams = {
        filters: {
          raw_contains: 'Error'
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%Error%') ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

  })

  describe('Level Filtering (Pattern Matching)', () => {
    it('should generate level filter using pattern matching', async () => {
      const params: StructuredQueryParams = {
        filters: {
          level: 'ERROR'
        },
        limit: 50
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%\"level\":\"error\"%') ORDER BY dt DESC LIMIT 50 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should handle all valid log levels', async () => {
      const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
      
      for (const level of levels) {
        const params: StructuredQueryParams = {
          filters: { level: level as any },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe(`SELECT dt, raw FROM logs WHERE ilike(raw, '%\"level\":\"${level.toLowerCase()}\"%') ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`)
      }
    })
  })

  describe('Time Range Filtering', () => {
    describe('Relative Time Filters - Minutes', () => {
      it('should handle last_30_minutes', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_30_minutes'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 30 MINUTE ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })

      it('should handle last_60_minutes', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_60_minutes'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 60 MINUTE ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })
    })

    describe('Relative Time Filters - Hours', () => {
      it('should handle last_3_hours', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_3_hours'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 3 HOUR ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })

      it('should handle last_6_hours', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_6_hours'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 6 HOUR ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })

      it('should handle last_12_hours', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_12_hours'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 12 HOUR ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })

      it('should handle last_24_hours', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_24_hours'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 24 HOUR ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })
    })

    describe('Relative Time Filters - Days', () => {
      it('should handle last_2_days', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_2_days'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 2 DAY ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })

      it('should handle last_7_days', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_7_days'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 7 DAY ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })

      it('should handle last_14_days', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_14_days'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 14 DAY ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })

      it('should handle last_30_days', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'last_30_days'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 30 DAY ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })
    })

    describe('Relative Time Filters - Special Cases', () => {
      it('should handle everything (no time filter)', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              relative: 'everything'
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
      })
    })

    describe('Custom Time Filters', () => {
      it('should generate absolute time range filters', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              custom: {
                start_datetime: '2024-01-15',
                end_datetime: '2024-01-16'
              }
            }
          },
          limit: 10
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= '2024-01-15' AND dt <= '2024-01-16' ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
      })

      it('should handle tight time spans with precise timestamps', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              custom: {
                start_datetime: '2024-01-15T14:30:00',
                end_datetime: '2024-01-15T14:32:00'
              }
            }
          },
          limit: 50
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= '2024-01-15T14:30:00' AND dt <= '2024-01-15T14:32:00' ORDER BY dt DESC LIMIT 50 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
      })

      it('should handle 10-minute debugging windows', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              custom: {
                start_datetime: '2024-01-15T09:15:00',
                end_datetime: '2024-01-15T09:25:00'
              }
            }
          },
          limit: 100
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= '2024-01-15T09:15:00' AND dt <= '2024-01-15T09:25:00' ORDER BY dt DESC LIMIT 100 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
      })

      it('should handle second precision for very tight windows', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              custom: {
                start_datetime: '2024-01-15T14:30:15',
                end_datetime: '2024-01-15T14:30:25'
              }
            }
          },
          limit: 20
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= '2024-01-15T14:30:15' AND dt <= '2024-01-15T14:30:25' ORDER BY dt DESC LIMIT 20 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
      })

      it('should handle start-only filter for logs after specific time', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              custom: {
                start_datetime: '2024-01-15T14:30:00'
              }
            }
          },
          limit: 25
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= '2024-01-15T14:30:00' ORDER BY dt DESC LIMIT 25 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
      })

      it('should handle end-only filter for logs before specific time', async () => {
        const params: StructuredQueryParams = {
          filters: {
            time_filter: {
              custom: {
                end_datetime: '2024-01-15T14:30:00'
              }
            }
          },
          limit: 25
        }

        const query = await buildStructuredQuery(params)
        expect(query).toBe("SELECT dt, raw FROM logs WHERE dt <= '2024-01-15T14:30:00' ORDER BY dt DESC LIMIT 25 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
      })
    })
  })


  describe('Multiple Filters', () => {
    it('should combine multiple filters with AND', async () => {
      const params: StructuredQueryParams = {
        filters: {
          raw_contains: 'api',
          level: 'ERROR',
          time_filter: {
            relative: 'last_60_minutes'
          }
        },
        limit: 25
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%api%') AND ilike(raw, '%\"level\":\"error\"%') AND dt >= now() - INTERVAL 60 MINUTE ORDER BY dt DESC LIMIT 25 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should handle all filter types together', async () => {
      const params: StructuredQueryParams = {
        filters: {
          raw_contains: 'payment',
          level: 'INFO',
          time_filter: {
            relative: 'last_2_days'
          }
        },
        limit: 100
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%payment%') AND ilike(raw, '%\"level\":\"info\"%') AND dt >= now() - INTERVAL 2 DAY ORDER BY dt DESC LIMIT 100 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should handle tight time window debugging with error filtering', async () => {
      const params: StructuredQueryParams = {
        filters: {
          raw_contains: 'database connection',
          level: 'ERROR',
          time_filter: {
            custom: {
              start_datetime: '2024-01-15T14:30:00',
              end_datetime: '2024-01-15T14:32:00'
            }
          }
        },
        limit: 50
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%database connection%') AND ilike(raw, '%\"level\":\"error\"%') AND dt >= '2024-01-15T14:30:00' AND dt <= '2024-01-15T14:32:00' ORDER BY dt DESC LIMIT 50 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle combined filtering without JSON field extraction', async () => {
      const params: StructuredQueryParams = {
        filters: {
          level: 'ERROR',
          raw_contains: 'api request',
          time_filter: {
            relative: 'last_6_hours'
          }
        },
        limit: 50
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%api request%') AND ilike(raw, '%\"level\":\"error\"%') AND dt >= now() - INTERVAL 6 HOUR ORDER BY dt DESC LIMIT 50 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should handle no filters (basic query with ordering only)', async () => {
      const params: StructuredQueryParams = {
        limit: 5
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 5 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })
  })

  describe('Error Conditions and Edge Cases', () => {
    it('should throw error for invalid log level', async () => {
      const params: StructuredQueryParams = {
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
        limit: 1
      }
      const query1 = await buildStructuredQuery(params1)
      expect(query1).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 1 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')

      // Test maximum limit
      const params2: StructuredQueryParams = {
        limit: 1000
      }
      const query2 = await buildStructuredQuery(params2)
      expect(query2).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 1000 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
    })

    it('should handle special characters in filter values', async () => {
      const params: StructuredQueryParams = {
        filters: {
          raw_contains: "user's data with \"quotes\" and \nnewlines"
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toContain("ilike(raw, '%user''s data with \"quotes\" and \nnewlines%')")
    })
  })

  describe('Data Type Handling', () => {
    it('should add _row_type filter for historical data', async () => {
      const params: StructuredQueryParams = {
        dataType: 'historical',
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs WHERE _row_type = 1 ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
    })

    it('should combine _row_type filter with other filters for historical data', async () => {
      const params: StructuredQueryParams = {
        dataType: 'historical',
        filters: {
          raw_contains: 'error',
          level: 'ERROR'
        },
        limit: 20
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE _row_type = 1 AND ilike(raw, '%error%') AND ilike(raw, '%\"level\":\"error\"%') ORDER BY dt DESC LIMIT 20 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should not add _row_type filter for recent data', async () => {
      const params: StructuredQueryParams = {
        dataType: 'recent',
        filters: {
          raw_contains: 'info'
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%info%') ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should not add _row_type filter for metrics data', async () => {
      const params: StructuredQueryParams = {
        dataType: 'metrics',
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
    })

    it('should not add _row_type filter when dataType is undefined', async () => {
      const params: StructuredQueryParams = {
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
    })
  })

  describe('ISO Date Format Support', () => {
    it('should accept ISO dates with Z timezone suffix', async () => {
      const params: StructuredQueryParams = {
        filters: {
          time_filter: {
            custom: {
              start_datetime: '2024-07-28T10:00:00Z',
              end_datetime: '2024-07-28T12:00:00Z'
            }
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= parseDateTime64BestEffort('2024-07-28T10:00:00Z') AND dt <= parseDateTime64BestEffort('2024-07-28T12:00:00Z') ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should accept ISO dates with timezone offset', async () => {
      const params: StructuredQueryParams = {
        filters: {
          time_filter: {
            custom: {
              start_datetime: '2024-07-28T10:00:00+00:00',
              end_datetime: '2024-07-28T12:00:00-05:00'
            }
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= parseDateTime64BestEffort('2024-07-28T10:00:00+00:00') AND dt <= parseDateTime64BestEffort('2024-07-28T12:00:00-05:00') ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should still accept ISO dates without timezone', async () => {
      const params: StructuredQueryParams = {
        filters: {
          time_filter: {
            custom: {
              start_datetime: '2024-07-28T10:00:00',
              end_datetime: '2024-07-28T12:00:00'
            }
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= '2024-07-28T10:00:00' AND dt <= '2024-07-28T12:00:00' ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })

    it('should still accept date-only format', async () => {
      const params: StructuredQueryParams = {
        filters: {
          time_filter: {
            custom: {
              start_datetime: '2024-07-28',
              end_datetime: '2024-07-29'
            }
          }
        },
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE dt >= '2024-07-28' AND dt <= '2024-07-29' ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow")
    })
  })

  describe('Output Format Support', () => {
    it('should default to JSONEachRow format with SETTINGS', async () => {
      const params: StructuredQueryParams = {
        limit: 10
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
    })

    it('should explicitly use JSONEachRow format with SETTINGS', async () => {
      const params: StructuredQueryParams = {
        limit: 10,
        format: 'JSONEachRow'
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow')
    })

    it('should use JSON format without SETTINGS', async () => {
      const params: StructuredQueryParams = {
        limit: 10,
        format: 'JSON'
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 FORMAT JSON')
    })

    it('should use Pretty format without SETTINGS', async () => {
      const params: StructuredQueryParams = {
        limit: 10,
        format: 'Pretty'
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 FORMAT Pretty')
    })

    it('should use CSV format without SETTINGS', async () => {
      const params: StructuredQueryParams = {
        limit: 10,
        format: 'CSV'
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 FORMAT CSV')
    })

    it('should use TSV format without SETTINGS', async () => {
      const params: StructuredQueryParams = {
        limit: 10,
        format: 'TSV'
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe('SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 10 FORMAT TSV')
    })

    it('should combine format with filters (no JSON extraction)', async () => {
      const params: StructuredQueryParams = {
        filters: {
          raw_contains: 'error',
          time_filter: {
            relative: 'last_60_minutes'
          }
        },
        limit: 25,
        format: 'Pretty'
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE ilike(raw, '%error%') AND dt >= now() - INTERVAL 60 MINUTE ORDER BY dt DESC LIMIT 25 FORMAT Pretty")
    })

    it('should work with historical data type and CSV format', async () => {
      const params: StructuredQueryParams = {
        dataType: 'historical',
        filters: {
          level: 'ERROR'
        },
        limit: 50,
        format: 'CSV'
      }

      const query = await buildStructuredQuery(params)
      expect(query).toBe("SELECT dt, raw FROM logs WHERE _row_type = 1 AND ilike(raw, '%\"level\":\"error\"%') ORDER BY dt DESC LIMIT 50 FORMAT CSV")
    })
  })
})