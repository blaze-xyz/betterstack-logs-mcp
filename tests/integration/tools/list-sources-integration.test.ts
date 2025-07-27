import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { McpTestHelper } from '../../helpers/mcp-test-helper.js'
import { createTestServer } from '../../helpers/test-server-factory.js'
import { http, HttpResponse } from 'msw'

describe('List Sources Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
  })

  describe('list_sources tool via MCP protocol', () => {
    it('should return properly formatted MCP response with sources list', async () => {
      const result = await mcpHelper.callTool('list_sources')

      // Validate MCP response format
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content.length).toBeGreaterThan(0)
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0]).toHaveProperty('text')
      
      // Validate content includes expected source information
      const text = result.content[0].text
      expect(text).toContain('Available Log Sources')
      expect(text).toContain('Spark - staging | deprecated')
      expect(text).toContain('ID: 1021715')
      expect(text).toContain('Platform: ubuntu')
      expect(text).toContain('Retention: 7 days')
    })

    it('should handle empty sources gracefully via MCP protocol', async () => {
      // Override mock to return empty sources
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.json({ data: [] })
        })
      )

      const result = await mcpHelper.callTool('list_sources')

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('No sources found')
      expect(text).toContain('1. No logs have been configured in Betterstack')
      expect(text).toContain('2. API endpoint for listing sources is not available')
      expect(text).toContain('3. Authentication issues')
    })

    it('should handle API errors gracefully via MCP protocol', async () => {
      // Override mock to return error
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        })
      )

      const result = await mcpHelper.callTool('list_sources')

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('No sources found')
      expect(text).toContain('Authentication issues')
    })
  })
})