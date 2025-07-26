import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../src/betterstack-client.js'
import { McpTestHelper } from '../helpers/mcp-test-helper.js'
import { createTestServer } from '../helpers/test-server-factory.js'
import { http, HttpResponse } from 'msw'

describe('Test Connection Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
  })

  describe('test_connection tool via MCP protocol', () => {
    it('should test connections to both APIs via MCP protocol', async () => {
      const result = await mcpHelper.callTool('test_connection')

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('✅ Connection successful')
      expect(text).toContain('both Telemetry API and ClickHouse are accessible')
    })

    it('should handle connection failures via MCP protocol', async () => {
      // Mock API failures
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.error()
        })
      )

      const result = await mcpHelper.callTool('test_connection')

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Connection failed')
      expect(text).toContain('check your API token and network connectivity')
    })
  })
})