import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../src/betterstack-client.js'
import { McpTestHelper } from '../helpers/mcp-test-helper.js'
import { createTestServer } from '../helpers/test-server-factory.js'

describe('Get Source Info Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
  })

  describe('get_source_info tool via MCP protocol', () => {
    it('should return detailed source information via MCP protocol', async () => {
      const result = await mcpHelper.callTool('get_source_info', { source_id: '1021715' })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('**Source: Spark - staging | deprecated**')
      expect(text).toContain('ID: 1021715')
      expect(text).toContain('Platform: ubuntu')
      expect(text).toContain('Retention: 7 days')
      expect(text).toContain('Created: 1/1/2024')
      expect(text).toContain('Updated: 1/15/2024')
    })

    it('should handle non-existent source ID via MCP protocol', async () => {
      const result = await mcpHelper.callTool('get_source_info', { source_id: 'nonexistent' })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Source not found: nonexistent')
      expect(text).toContain("Use the 'list_sources' tool to see available sources")
    })
  })
})