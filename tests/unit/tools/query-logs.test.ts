import { describe, it, expect, beforeEach } from 'vitest'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { createTestConfig } from '../../helpers/test-config.js'
import { http, HttpResponse } from 'msw'
import { QueryOptions, QueryResult } from '../../../src/types.js'


describe('Query Logs Tool', () => {
  let client: BetterstackClient

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig())
  })

  describe('executeQuery', () => {
    it('should execute basic query and return formatted results', async () => {
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'Application started', level: 'INFO' },
        { dt: '2024-01-01T10:01:00Z', raw: 'User login successful', level: 'INFO' },
        { dt: '2024-01-01T10:02:00Z', raw: 'Database connection error', level: 'ERROR' }
      ]

      // Mock the ClickHouse response to match actual structure
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({
            data: mockData
          })
        })
      )

      const query = 'SELECT dt, raw, level FROM logs ORDER BY dt DESC LIMIT 3'
      const result = await client.executeQuery(query)

      expect(result.data).toHaveLength(3)
      expect(result.data[0]).toEqual({
        dt: '2024-01-01T10:00:00Z',
        raw: 'Application started',
        level: 'INFO'
      })
      // By default, all sources are queried when no filter is specified
      expect(result.meta?.sources_queried).toEqual(['Spark - staging | deprecated', 'Production API Server', 'Frontend Application', 'Database Service'])
    })

    it('should handle query with specific sources filter', async () => {
      const options: QueryOptions = {
        sources: ['1021716'], // Production API Server ID
        limit: 10
      }

      const mockQueryResult: QueryResult = {
        data: [
          { dt: '2024-01-01T10:00:00Z', raw: 'API request processed', source: 'Production API Server' }
        ],
        meta: {
          sources_queried: ['Production API Server'],
          total_rows: 1
        }
      }

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json(mockQueryResult)
        })
      )

      const query = 'SELECT dt, raw FROM logs WHERE raw LIKE "%API%" LIMIT 10'
      const result = await client.executeQuery(query, options)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].raw).toBe('API request processed')
      expect(result.meta?.sources_queried).toEqual(['Production API Server'])
    })

    it('should handle query with source group filter', async () => {
      const options: QueryOptions = {
        sourceGroup: 'Development Environment'
      }

      const mockQueryResult: QueryResult = {
        data: [
          { dt: '2024-01-01T10:00:00Z', raw: 'Dev environment log', source: 'Spark - staging | deprecated' },
          { dt: '2024-01-01T10:01:00Z', raw: 'Frontend log entry', source: 'Frontend Application' }
        ],
        meta: {
          sources_queried: ['Spark - staging | deprecated', 'Frontend Application'],
          total_rows: 2
        }
      }

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json(mockQueryResult)
        })
      )

      const query = 'SELECT dt, raw FROM logs ORDER BY dt DESC'
      const result = await client.executeQuery(query, options)

      expect(result.data).toHaveLength(2)
      expect(result.meta?.sources_queried).toContain('Spark - staging | deprecated')
      expect(result.meta?.sources_queried).toContain('Frontend Application')
    })

    it('should handle empty results gracefully', async () => {
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({
            data: []
          })
        })
      )

      const query = 'SELECT dt, raw FROM logs WHERE raw LIKE "%nonexistent%" LIMIT 10'
      const result = await client.executeQuery(query)

      expect(result.data).toEqual([])
      expect(result.meta?.sources_queried).toEqual(['Spark - staging | deprecated', 'Production API Server', 'Frontend Application', 'Database Service'])
    })

    it('should handle different data types (historical)', async () => {
      const options: QueryOptions = {
        limit: 5
      }

      const mockData = [
        { dt: '2024-01-01T00:00:00Z', raw: 'Historical log entry', level: 'INFO' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({
            data: mockData
          })
        })
      )

      const query = 'SELECT dt, raw FROM logs WHERE dt >= "2024-01-01" ORDER BY dt ASC'
      const result = await client.executeQuery(query, options)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].dt).toBe('2024-01-01T00:00:00Z')
    })

    it('should handle metrics data type', async () => {
      const options: QueryOptions = {
        limit: 3
      }

      const mockData = [
        { dt: '2024-01-01T10:00:00Z', metric_name: 'response_time', value: 125 },
        { dt: '2024-01-01T10:01:00Z', metric_name: 'cpu_usage', value: 45.2 },
        { dt: '2024-01-01T10:02:00Z', metric_name: 'memory_usage', value: 78.5 }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({
            data: mockData
          })
        })
      )

      const query = 'SELECT dt, metric_name, value FROM metrics ORDER BY dt DESC LIMIT 3'
      const result = await client.executeQuery(query, options)

      expect(result.data).toHaveLength(3)
      expect(result.data[0].metric_name).toBe('response_time')
      expect(result.data[0].value).toBe(125)
    })

    it('should handle ClickHouse API errors gracefully', async () => {
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json(
            { 
              error: 'Syntax error',
              message: 'Invalid SQL query syntax'
            },
            { status: 400 }
          )
        })
      )

      const query = 'SELECT invalid syntax FROM logs'
      
      await expect(client.executeQuery(query)).rejects.toThrow()
    })

    it('should handle network timeouts', async () => {
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.error()
        })
      )

      const query = 'SELECT dt, raw FROM logs LIMIT 1'
      
      await expect(client.executeQuery(query)).rejects.toThrow()
    })

    it('should handle rate limiting', async () => {
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json(
            { 
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.'
            },
            { status: 429 }
          )
        })
      )

      const query = 'SELECT dt, raw FROM logs LIMIT 1'
      
      await expect(client.executeQuery(query)).rejects.toThrow()
    })

    it('should apply limit option correctly', async () => {
      const options: QueryOptions = {
        limit: 2
      }

      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'Log entry 1' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Log entry 2' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({
            data: mockData
          })
        })
      )

      const query = 'SELECT dt, raw FROM logs ORDER BY dt DESC'
      const result = await client.executeQuery(query, options)

      expect(result.data).toHaveLength(2)
      expect(result.meta?.sources_queried).toEqual(['Spark - staging | deprecated', 'Production API Server', 'Frontend Application', 'Database Service'])
    })

    it('should handle complex JSON log data', async () => {
      const mockData = [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: 'User action performed',
          json: { 
            user_id: 123, 
            action: 'login', 
            timestamp: '2024-01-01T10:00:00Z',
            metadata: { ip: '192.168.1.1', user_agent: 'Chrome' }
          }
        }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({
            data: mockData
          })
        })
      )

      const query = 'SELECT dt, raw, json FROM logs WHERE json.action = "login" LIMIT 1'
      const result = await client.executeQuery(query)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].json).toEqual({
        user_id: 123,
        action: 'login',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: { ip: '192.168.1.1', user_agent: 'Chrome' }
      })
    })

    it('should handle queries with multiple sources by name', async () => {
      const options: QueryOptions = {
        sources: ['Production API Server', 'Frontend Application'] // Using names instead of IDs
      }

      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'API log', source: 'Production API Server' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Frontend log', source: 'Frontend Application' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({
            data: mockData
          })
        })
      )

      const query = 'SELECT dt, raw, source FROM logs ORDER BY dt DESC LIMIT 10'
      const result = await client.executeQuery(query, options)

      expect(result.data).toHaveLength(2)
      expect(result.meta?.sources_queried).toContain('Production API Server')
      expect(result.meta?.sources_queried).toContain('Frontend Application')
    })
  })

})