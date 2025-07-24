import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../src/betterstack-client.js'
import { McpTestHelper } from '../helpers/mcp-test-helper.js'
import { createTestServer } from '../helpers/test-server-factory.js'
import { http, HttpResponse } from 'msw'

describe('Source Management Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    // Create real MCP server with all tools registered
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
  })

  afterEach(() => {
    // Clean up if needed
  })

  describe('MCP Server Integration', () => {
    it('should register all expected source management tools', () => {
      const tools = mcpHelper.listTools()
      
      // Verify all source management tools are registered
      expect(tools).toContain('list_sources')
      expect(tools).toContain('list_source_groups')
      expect(tools).toContain('get_source_info')
      expect(tools).toContain('get_source_group_info')
      expect(tools).toContain('test_connection')
      
      // Should have all 14 tools registered
      expect(tools.length).toBeGreaterThanOrEqual(14)
    })

    it('should provide tool information for registered tools', () => {
      const toolInfo = mcpHelper.getToolInfo('list_sources')
      
      expect(toolInfo).toBeTruthy()
      expect(toolInfo?.name).toBe('list_sources')
      expect(toolInfo?.description).toBeTruthy()
    })
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

  describe('list_source_groups tool via MCP protocol', () => {
    it('should return properly formatted MCP response with source groups', async () => {
      const result = await mcpHelper.callTool('list_source_groups')

      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('type', 'text')
      
      const text = result.content[0].text
      expect(text).toContain('Available Source Groups')
      expect(text).toContain('Development Environment')
      expect(text).toContain('Production Environment')
      expect(text).toContain('Sources: 2 source(s)')
    })

    it('should handle team API token errors via MCP protocol', async () => {
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/source-groups', () => {
          return HttpResponse.json(
            { 
              error: 'Forbidden',
              errors: ['Invalid Team API token']
            },
            { status: 403 }
          )
        })
      )

      const result = await mcpHelper.callTool('list_source_groups')

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('No source groups found')
      expect(text).toContain('You may need a Team API token')
      expect(text).toContain('Source groups are logical collections')
    })
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

  describe('get_source_group_info tool via MCP protocol', () => {
    it('should return detailed source group information via MCP protocol', async () => {
      const result = await mcpHelper.callTool('get_source_group_info', { group_name: 'Development Environment' })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('**Source Group: Development Environment**')
      expect(text).toContain('ID: 1')
      expect(text).toContain('Total Sources: 2')
      expect(text).toContain('Minimum Retention: 7 days')
      expect(text).toContain('Created: 1/1/2024')
      expect(text).toContain('**Included Sources:**')
      expect(text).toContain('• **Spark - staging | deprecated** (ID: 1021715)')
      expect(text).toContain('• **Frontend Application** (ID: 1021717)')
    })

    it('should handle non-existent source group via MCP protocol', async () => {
      const result = await mcpHelper.callTool('get_source_group_info', { group_name: 'Non-existent Group' })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Source group not found: Non-existent Group')
      expect(text).toContain("Use the 'list_source_groups' tool to see available groups")
    })
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