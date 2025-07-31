import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { McpTestHelper } from '../../helpers/mcp-test-helper.js'
import { createTestServer } from '../../helpers/test-server-factory.js'
import { http, HttpResponse } from 'msw'

describe('List Source Groups Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    client = testServer.client
    mcpHelper = new McpTestHelper(server)
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
      expect(text).toContain('Sources: 3 source(s)') // Development Environment has 3 sources
      expect(text).toContain('Sources: 1 source(s)') // Production Environment has 1 source
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
})