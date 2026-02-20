import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { McpTestHelper } from '../../helpers/mcp-test-helper.js'
import { createTestServer } from '../../helpers/test-server-factory.js'

describe('Debug Table Info Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
  })

  describe('debug_table_info tool via MCP protocol', () => {
    it('should return table info for a single source', async () => {
      const result = await mcpHelper.callTool('debug_table_info', {
        sources: ['Spark - staging | deprecated']
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('**Source: Spark - staging | deprecated**')
      expect(text).toContain('Resolved Sources (1)')
    })

    it('should return table info for a source group', async () => {
      const result = await mcpHelper.callTool('debug_table_info', {
        source_group: 'Development Environment'
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('Debug Information')
      expect(text).not.toContain('Debug failed')
    })

    it('should handle source group with multiple sources without failing', async () => {
      const result = await mcpHelper.callTool('debug_table_info', {
        source_group: 'Development Environment'
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      // Should contain info for multiple sources in the group
      expect(text).toContain('**Source: Spark - staging | deprecated**')
      expect(text).toContain('**Source: Frontend Application**')
      expect(text).toContain('**Source: Database Service**')
    })
  })
})
