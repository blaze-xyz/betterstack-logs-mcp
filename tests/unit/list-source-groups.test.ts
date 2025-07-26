import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BetterstackClient } from '../../src/betterstack-client.js'
import { createTestConfig } from '../helpers/test-config.js'
import { mockApiSourceGroups } from '../__mocks__/betterstack-responses.js'
import { http, HttpResponse } from 'msw'

describe('List Source Groups Tool', () => {
  let client: BetterstackClient

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig())
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
})