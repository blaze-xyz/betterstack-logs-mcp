import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../src/betterstack-client.js'
import { registerSourceManagementTools } from '../../src/tools/source-management.js'
import { createTestConfig } from '../helpers/test-config.js'
import { http, HttpResponse } from 'msw'

describe('Source Management Integration Tests', () => {
  let server: McpServer
  let client: BetterstackClient

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    })
    
    client = new BetterstackClient(createTestConfig())
    registerSourceManagementTools(server, client)
  })

  describe('list_sources tool', () => {
    it('should return formatted source list with markdown', async () => {
      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'list_sources',
          arguments: {}
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('**Available Log Sources (3):**')
      expect(text).toContain('• **Spark - staging | deprecated** (ID: 1021715)')
      expect(text).toContain('Platform: ubuntu')
      expect(text).toContain('Retention: 7 days')
      expect(text).toContain('• **Production API Server** (ID: 1021716)')
      expect(text).toContain('Platform: linux') 
      expect(text).toContain('Retention: 30 days')
    })

    it('should handle empty sources list', async () => {
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.json({ data: [] })
        })
      )

      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'list_sources',
          arguments: {}
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('No sources found')
      expect(text).toContain('1. No logs have been configured in Betterstack')
      expect(text).toContain('2. API endpoint for listing sources is not available')
      expect(text).toContain('3. Authentication issues')
    })

    it('should handle API errors gracefully', async () => {
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        })
      )

      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'list_sources',
          arguments: {}
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Failed to list sources:')
    })
  })

  describe('list_source_groups tool', () => {
    it('should return formatted source groups list', async () => {
      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'list_source_groups',
          arguments: {}
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('**Available Source Groups (2):**')
      expect(text).toContain('• **Development Environment** (ID: 1)')
      expect(text).toContain('Sources: 2 source(s) - 1021715, 1021717')
      expect(text).toContain('• **Production Environment** (ID: 2)')
      expect(text).toContain('Sources: 1 source(s) - 1021716')
    })

    it('should handle team API token errors', async () => {
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

      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'list_source_groups',
          arguments: {}
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('No source groups found')
      expect(text).toContain('You may need a Team API token')
      expect(text).toContain('Source groups are logical collections')
    })

    it('should handle general API errors', async () => {
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/source-groups', () => {
          return HttpResponse.json(
            { error: 'Server Error' },
            { status: 500 }
          )
        })
      )

      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'list_source_groups',
          arguments: {}
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Failed to list source groups:')
    })
  })

  describe('get_source_info tool', () => {
    it('should return detailed source information', async () => {
      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_info',
          arguments: {
            source_id: '1021715'
          }
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('**Source: Spark - staging | deprecated**')
      expect(text).toContain('ID: 1021715')
      expect(text).toContain('Platform: ubuntu')
      expect(text).toContain('Retention: 7 days')
      expect(text).toContain('Created: 1/1/2024')
      expect(text).toContain('Updated: 1/15/2024')
    })

    it('should handle non-existent source ID', async () => {
      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_info',
          arguments: {
            source_id: 'nonexistent'
          }
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Source not found: nonexistent')
      expect(text).toContain("Use the 'list_sources' tool to see available sources")
    })

    it('should handle API errors during source info retrieval', async () => {
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          throw new Error('Network error')
        })
      )

      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_info',
          arguments: {
            source_id: '1021715'
          }
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Failed to get source info:')
    })
  })

  describe('get_source_group_info tool', () => {
    it('should return detailed source group information', async () => {
      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_group_info',
          arguments: {
            group_name: 'Development Environment'
          }
        }
      })

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

    it('should handle non-existent source group', async () => {
      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_group_info',
          arguments: {
            group_name: 'Non-existent Group'
          }
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Source group not found: Non-existent Group')
      expect(text).toContain("Use the 'list_source_groups' tool to see available groups")
    })

    it('should handle groups with no sources', async () => {
      // Mock an empty group
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/source-groups', () => {
          return HttpResponse.json({
            data: [
              {
                id: "99",
                type: "source_group",
                attributes: {
                  name: "Empty Group",
                  created_at: "2024-01-01T10:00:00Z",
                  updated_at: "2024-01-15T10:00:00Z",
                  sort_index: 99,
                  team_name: "Test Team"
                }
              }
            ]
          })
        })
      )

      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_group_info',
          arguments: {
            group_name: 'Empty Group'
          }
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('**Source Group: Empty Group**')
      expect(text).toContain('Total Sources: 0')
      expect(text).toContain('(No sources found)')
    })

    it('should handle API errors during group info retrieval', async () => {
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/source-groups', () => {
          throw new Error('Network error')
        })
      )

      const result = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_group_info',
          arguments: {
            group_name: 'Development Environment'
          }
        }
      })

      expect(result.content[0].type).toBe('text')
      const text = result.content[0].text
      expect(text).toContain('❌ Failed to get source group info:')
    })
  })

  describe('cross-tool workflow integration', () => {
    it('should support discovering sources then getting detailed info', async () => {
      // First, list sources
      const sourcesResult = await server.request({
        method: 'tools/call',
        params: {
          name: 'list_sources',
          arguments: {}
        }
      })

      expect(sourcesResult.content[0].text).toContain('ID: 1021715')

      // Then get detailed info for a specific source
      const detailResult = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_info',
          arguments: {
            source_id: '1021715'
          }
        }
      })

      expect(detailResult.content[0].text).toContain('**Source: Spark - staging | deprecated**')
      expect(detailResult.content[0].text).toContain('Platform: ubuntu')
    })

    it('should support discovering groups then getting detailed group info', async () => {
      // First, list source groups
      const groupsResult = await server.request({
        method: 'tools/call',
        params: {
          name: 'list_source_groups',
          arguments: {}
        }
      })

      expect(groupsResult.content[0].text).toContain('Development Environment')

      // Then get detailed info for a specific group
      const groupDetailResult = await server.request({
        method: 'tools/call',
        params: {
          name: 'get_source_group_info',
          arguments: {
            group_name: 'Development Environment'
          }
        }
      })

      expect(groupDetailResult.content[0].text).toContain('**Source Group: Development Environment**')
      expect(groupDetailResult.content[0].text).toContain('Total Sources: 2')
    })
  })
})