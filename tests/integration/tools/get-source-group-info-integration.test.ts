import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { McpTestHelper } from '../../helpers/mcp-test-helper.js'
import { createTestServer } from '../../helpers/test-server-factory.js'

describe('Get Source Group Info Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
  })

  describe('get_source_group_info tool via MCP protocol', () => {
    it('should return detailed source group information via MCP protocol', async () => {
      const result = await mcpHelper.callTool('get_source_group_info', { group_name: 'Development Environment' })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('**Source Group: Development Environment**')
      expect(text).toContain('ID: 1')
      expect(text).toContain('Total Sources: 3')
      expect(text).toContain('Minimum Retention: 7 days')
      expect(text).toContain('Created: 1/1/2024')
      expect(text).toContain('**Included Sources:**')
      expect(text).toContain('• **Spark - staging | deprecated** (ID: 1021715)')
      expect(text).toContain('• **Frontend Application** (ID: 1021717)')
      expect(text).toContain('• **Database Service** (ID: 1021718)')
    })

    it('should handle non-existent source group via MCP protocol', async () => {
      const result = await mcpHelper.callTool('get_source_group_info', { group_name: 'Non-existent Group' })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Source group not found: Non-existent Group')
      expect(text).toContain("Use the 'list_source_groups' tool to see available groups")
    })
  })
})