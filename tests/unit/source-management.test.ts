import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BetterstackClient } from '../../src/betterstack-client.js'
import { createTestConfig } from '../helpers/test-config.js'
import { mockApiSources, mockApiSourceGroups } from '../__mocks__/betterstack-responses.js'
import { http, HttpResponse } from 'msw'

describe('Source Management Tools', () => {
  let client: BetterstackClient

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig())
  })

  describe('listSources', () => {
    it('should return list of sources', async () => {
      const sources = await client.listSources()
      
      expect(sources).toHaveLength(3)
      expect(sources[0]).toEqual({
        id: "1021715",
        name: "Spark - staging | deprecated",
        platform: "ubuntu",
        retention_days: 7,
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
        source_group_id: 1,
        table_name: "spark_staging_logs",
        team_id: 12345
      })
    })

    it('should return empty array when no sources available', async () => {
      // Override the handler to return empty results
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.json({ data: [] })
        })
      )

      const sources = await client.listSources()
      expect(sources).toEqual([])
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

      const sources = await client.listSources()
      expect(sources).toEqual([])
    })

    it('should cache sources and return cached data on subsequent calls', async () => {
      const spy = vi.fn()
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', (info) => {
          spy()
          return HttpResponse.json({ data: mockApiSources })
        })
      )

      // First call should make API request
      await client.listSources()
      expect(spy).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await client.listSources()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('getSourceInfo', () => {
    it('should return source info for valid source ID', async () => {
      const sourceInfo = await client.getSourceInfo("1021715")
      
      expect(sourceInfo).toBeTruthy()
      expect(sourceInfo?.name).toBe("Spark - staging | deprecated")
      expect(sourceInfo?.platform).toBe("ubuntu")
      expect(sourceInfo?.retention_days).toBe(7)
    })

    it('should return null for invalid source ID', async () => {
      const sourceInfo = await client.getSourceInfo("nonexistent")
      expect(sourceInfo).toBeNull()
    })

    it('should return source info when searching by name', async () => {
      const sources = await client.listSources()
      const targetSource = sources.find(s => s.name === "Production API Server")
      
      expect(targetSource).toBeTruthy()
      expect(targetSource?.platform).toBe("linux")
      expect(targetSource?.retention_days).toBe(30)
    })
  })

  describe('listSourceGroups', () => {
    it('should return list of source groups', async () => {
      const groups = await client.listSourceGroups()
      
      expect(groups).toHaveLength(2)
      expect(groups[0]).toEqual(expect.objectContaining({
        id: "1",
        name: "Development Environment",
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
        sort_index: 0,
        team_name: "Engineering Team"
      }))
    })

    it('should populate source_ids for each group', async () => {
      const groups = await client.listSourceGroups()
      
      const devGroup = groups.find(g => g.name === "Development Environment")
      expect(devGroup?.source_ids).toEqual(["1021715", "1021717"])
      
      const prodGroup = groups.find(g => g.name === "Production Environment")
      expect(prodGroup?.source_ids).toEqual(["1021716"])
    })

    it('should return empty array for team API token error', async () => {
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

      const groups = await client.listSourceGroups()
      expect(groups).toEqual([])
    })

    it('should cache source groups', async () => {
      const spy = vi.fn()
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/source-groups', () => {
          spy()
          return HttpResponse.json({ data: mockApiSourceGroups })
        })
      )

      // First call
      await client.listSourceGroups()
      expect(spy).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await client.listSourceGroups()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('getSourceGroupInfo', () => {
    it('should return detailed source group info', async () => {
      const groupInfo = await client.getSourceGroupInfo("Development Environment")
      
      expect(groupInfo).toBeTruthy()
      expect(groupInfo?.name).toBe("Development Environment")
      expect(groupInfo?.total_sources).toBe(2)
      expect(groupInfo?.sources).toHaveLength(2)
      expect(groupInfo?.sources.map(s => s.name)).toEqual([
        "Spark - staging | deprecated",
        "Frontend Application"
      ])
    })

    it('should calculate aggregate retention days correctly', async () => {
      const groupInfo = await client.getSourceGroupInfo("Development Environment")
      
      // Should return minimum retention days (7 days from Spark source, 14 from Frontend)
      expect(groupInfo?.aggregate_retention_days).toBe(7)
    })

    it('should return null for non-existent group', async () => {
      const groupInfo = await client.getSourceGroupInfo("Non-existent Group")
      expect(groupInfo).toBeNull()
    })

    it('should handle empty source groups', async () => {
      // Add a group with no sources
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/source-groups', () => {
          return HttpResponse.json({
            data: [
              {
                id: "3",
                type: "source_group",
                attributes: {
                  name: "Empty Group",
                  created_at: "2024-01-01T10:00:00Z",
                  updated_at: "2024-01-15T10:00:00Z",
                  sort_index: 2,
                  team_name: "Engineering Team"
                }
              }
            ]
          })
        })
      )

      const groupInfo = await client.getSourceGroupInfo("Empty Group")
      
      expect(groupInfo).toBeTruthy()
      expect(groupInfo?.total_sources).toBe(0)
      expect(groupInfo?.sources).toEqual([])
      expect(groupInfo?.aggregate_retention_days).toBeUndefined()
    })
  })

  describe('testConnection', () => {
    it('should return true when both APIs are accessible', async () => {
      const result = await client.testConnection()
      expect(result).toBe(true)
    })

    it('should return false when telemetry API fails', async () => {
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.error()
        })
      )

      const result = await client.testConnection()
      expect(result).toBe(false)
    })

    it('should return false when ClickHouse API fails', async () => {
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.error()
        })
      )

      const result = await client.testConnection()
      expect(result).toBe(false)
    })

    it('should return false when both APIs fail', async () => {
      globalThis.__MSW_SERVER__.use(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.error()
        }),
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.error()
        })
      )

      const result = await client.testConnection()
      expect(result).toBe(false)
    })
  })
})