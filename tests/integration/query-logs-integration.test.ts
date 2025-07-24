import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { BetterstackClient } from '../../src/betterstack-client.js'
import { createTestServer } from '../helpers/test-server-factory.js'
import { McpTestHelper } from '../helpers/mcp-test-helper.js'
import { http, HttpResponse } from 'msw'

describe('Query Logs Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
  })

  describe('query_logs tool via MCP protocol', () => {
    it('should return properly formatted MCP response with basic query results', async () => {
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'Application started', level: 'INFO' },
        { dt: '2024-01-01T10:01:00Z', raw: 'User login successful', level: 'INFO' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw, level FROM logs ORDER BY dt DESC LIMIT 2'
      })

      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('Application started')
      expect(result.content[0].text).toContain('User login successful')
    })

    it('should handle queries with source filtering via MCP protocol', async () => {
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'API request processed', source: 'Production API Server' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw FROM logs WHERE raw LIKE "%API%" LIMIT 1',
        sources: ['1021716'], // Production API Server ID
        data_type: 'recent'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('API request processed')
      expect(result.content[0].text).toContain('Sources queried: Production API Server')
    })

    it('should handle queries with source group filtering via MCP protocol', async () => {
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'Dev environment log', source: 'Spark - staging | deprecated' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Frontend log', source: 'Frontend Application' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw FROM logs ORDER BY dt DESC',
        source_group: 'Development Environment',
        data_type: 'recent'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('Dev environment log')
      expect(result.content[0].text).toContain('Frontend log')
    })

    it('should handle empty query results via MCP protocol', async () => {
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: [] })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw FROM logs WHERE raw LIKE "%nonexistent%" LIMIT 10'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('No results found')
    })

    it('should handle historical data type via MCP protocol', async () => {
      const mockData = [
        { dt: '2024-01-01T00:00:00Z', raw: 'Historical log entry', level: 'INFO' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw FROM logs WHERE dt >= "2024-01-01"',
        data_type: 'historical'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('Historical log entry')
    })

    it('should handle metrics data type via MCP protocol', async () => {
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', metric_name: 'response_time', value: 125 },
        { dt: '2024-01-01T10:01:00Z', metric_name: 'cpu_usage', value: 45.2 }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, metric_name, value FROM metrics ORDER BY dt DESC LIMIT 2',
        data_type: 'metrics'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('metric_name: response_time, value: 125')
      expect(result.content[0].text).toContain('metric_name: cpu_usage, value: 45.2')
    })

    it('should handle ClickHouse API errors gracefully via MCP protocol', async () => {
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

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT invalid syntax FROM logs'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('❌ Query failed')
      expect(result.content[0].text).toContain('Invalid SQL query syntax')
    })

    it('should handle network errors via MCP protocol', async () => {
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.error()
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw FROM logs LIMIT 1'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('❌ Query failed')
    })

    it('should apply limit parameter correctly via MCP protocol', async () => {
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'Log entry 1' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Log entry 2' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw FROM logs ORDER BY dt DESC',
        limit: 2
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('Log entry 1')
      expect(result.content[0].text).toContain('Log entry 2')
    })

    it('should handle complex JSON log data via MCP protocol', async () => {
      const mockData = [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: 'User action performed',
          json: { 
            user_id: 123, 
            action: 'login', 
            metadata: { ip: '192.168.1.1' }
          }
        }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw, json FROM logs WHERE json.action = "login" LIMIT 1'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('User action performed')
    })

    it('should handle large result sets with truncation via MCP protocol', async () => {
      // Create mock data with more than 10 entries to test truncation
      const mockData = Array.from({ length: 15 }, (_, i) => ({
        dt: `2024-01-01T10:${i.toString().padStart(2, '0')}:00Z`,
        raw: `Log entry ${i + 1}`
      }))

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw FROM logs ORDER BY dt DESC LIMIT 15'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('Log entry 1')
      expect(result.content[0].text).toContain('Log entry 10')
      expect(result.content[0].text).toContain('... and 5 more rows')
    })

    it('should handle queries with multiple sources by name via MCP protocol', async () => {
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'API log', source: 'Production API Server' },
        { dt: '2024-01-01T10:01:00Z', raw: 'Frontend log', source: 'Frontend Application' }
      ]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw, source FROM logs ORDER BY dt DESC LIMIT 10',
        sources: ['Production API Server', 'Frontend Application'],
        data_type: 'recent'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results**')
      expect(result.content[0].text).toContain('API log')
      expect(result.content[0].text).toContain('Frontend log')
    })

    it('should validate MCP response format compliance', async () => {
      const mockData = [{ dt: '2024-01-01T10:00:00Z', raw: 'Test log' }]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        query: 'SELECT dt, raw FROM logs LIMIT 1'
      })

      // Validate MCP response format
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content.length).toBeGreaterThan(0)
      expect(result.content[0]).toHaveProperty('type')
      expect(result.content[0]).toHaveProperty('text')
      expect(typeof result.content[0].text).toBe('string')
    })
  })
})