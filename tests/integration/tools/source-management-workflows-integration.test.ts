import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { McpTestHelper } from '../../helpers/mcp-test-helper.js'
import { createTestServer } from '../../helpers/test-server-factory.js'

describe('Source Management Workflows Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
  })

  describe('Cross-tool workflows via MCP protocol', () => {
    it('should support discovering sources then getting detailed info', async () => {
      // First, list sources
      const sourcesResult = await mcpHelper.callTool('list_sources')
      expect(sourcesResult.content[0].text).toContain('ID: 1021715')

      // Then get detailed info for a specific source
      const detailResult = await mcpHelper.callTool('get_source_info', { source_id: '1021715' })
      expect(detailResult.content[0].text).toContain('**Source: Spark - staging | deprecated**')
      expect(detailResult.content[0].text).toContain('Platform: ubuntu')
    })

    it('should support discovering groups then getting detailed group info', async () => {
      // First, list source groups
      const groupsResult = await mcpHelper.callTool('list_source_groups')
      expect(groupsResult.content[0].text).toContain('Development Environment')

      // Then get detailed info for a specific group
      const groupDetailResult = await mcpHelper.callTool('get_source_group_info', { group_name: 'Development Environment' })
      expect(groupDetailResult.content[0].text).toContain('**Source Group: Development Environment**')
      expect(groupDetailResult.content[0].text).toContain('Total Sources: 2')
    })
  })

  describe('MCP Protocol Validation', () => {
    it('should return proper MCP response format for all tools', async () => {
      const sourceManagementTools = ['list_sources', 'list_source_groups', 'get_source_info', 'get_source_group_info']
      
      for (const toolName of sourceManagementTools) {
        const args = toolName.includes('get_') 
          ? (toolName === 'get_source_info' ? { source_id: '1021715' } : { group_name: 'Development Environment' })
          : {}
        
        const result = await mcpHelper.callTool(toolName, args)
        
        // Validate MCP response structure
        expect(result).toHaveProperty('content')
        expect(Array.isArray(result.content)).toBe(true)
        expect(result.content.length).toBeGreaterThan(0)
        expect(result.content[0]).toHaveProperty('type')
        expect(result.content[0]).toHaveProperty('text')
        expect(typeof result.content[0].text).toBe('string')
        expect(result.content[0].text.length).toBeGreaterThan(0)
      }
    })

    it('should handle invalid tool names gracefully', async () => {
      const result = await mcpHelper.callTool('nonexistent_tool')
      
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('isError', true)
      expect(result.content[0].text).toContain('Tool "nonexistent_tool" not found')
      expect(result.content[0].text).toContain('Available tools:')
    })
  })
})