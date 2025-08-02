import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createTestServer } from '../../helpers/test-server-factory.js'
import { McpTestHelper } from '../../helpers/mcp-test-helper.js'
import { http, HttpResponse } from 'msw'

describe('Query Logs Integration Tests', () => {
  let server: McpServer
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
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
        limit: 2
      })

      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Compact View)**')
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
        filters: { raw_contains: ['API'] },
        sources: ['1021716'], // Production API Server ID
        limit: 1
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Compact View)**')
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
        source_group: 'Development Environment'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Compact View)**')
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
        filters: { raw_contains: ['nonexistent'] },
        limit: 10
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Compact View)**')
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
        filters: { 
          time_filter: { 
            custom: { 
              start_datetime: '2024-01-01', 
              end_datetime: '2024-01-02' 
            } 
          } 
        }
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Compact View)**')
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
        limit: 2,
        response_format: 'full'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Full View)**')
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
        filters: { raw_contains: ['invalid'] }
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
        limit: 1
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
        limit: 2
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Compact View)**')
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
        filters: { raw_contains: ['User action'] },
        limit: 1
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Compact View)**')
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
        limit: 15,
        response_format: 'full'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Full View)**')
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
        sources: ['Production API Server', 'Frontend Application'],
        limit: 10
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('**Query Results (Compact View)**')
      expect(result.content[0].text).toContain('API log')
      expect(result.content[0].text).toContain('Frontend log')
    })

    it('should properly format JSON objects in query results via MCP protocol', async () => {
      // Use MSW to override queries with test data that includes JSON objects
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', async ({ request }) => {
          const query = await request.text()
          
          if (query.includes('DESCRIBE TABLE remote(')) {
            // Return proper schema that includes the fields we want to test
            return HttpResponse.json({
              data: [
                ['dt', 'DateTime', '', '', '', '', ''],
                ['raw', 'String', '', '', '', '', ''],
                ['json', 'String', '', '', '', '', '']
              ]
            })
          }
          
          // Return test data with complex JSON object
          return HttpResponse.json({
            data: [
              { 
                dt: '2024-01-01T10:00:00Z', 
                raw: 'User action performed',
                json: { 
                  user_id: 123, 
                  action: 'login', 
                  timestamp: '2024-01-01T10:00:00Z',
                  nested: { ip: '192.168.1.1', user_agent: 'Chrome' }
                }
              }
            ]
          })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        limit: 1,
        response_format: 'full'
      })

      expect(result).toHaveProperty('content')
      expect(result.content[0]).toHaveProperty('type', 'text')
      
      // Verify JSON object is properly stringified (not [object Object])
      expect(result.content[0].text).toContain('json: {"user_id":123,"action":"login","timestamp":"2024-01-01T10:00:00Z","nested":{"ip":"192.168.1.1","user_agent":"Chrome"}}')
      expect(result.content[0].text).not.toContain('[object Object]')
      
      // Verify other fields are still formatted correctly
      expect(result.content[0].text).toContain('dt: 2024-01-01T10:00:00Z')
      expect(result.content[0].text).toContain('raw: User action performed')
    })

    it('should validate MCP response format compliance', async () => {
      const mockData = [{ dt: '2024-01-01T10:00:00Z', raw: 'Test log' }]

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData })
        })
      )

      const result = await mcpHelper.callTool('query_logs', {
        limit: 1
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