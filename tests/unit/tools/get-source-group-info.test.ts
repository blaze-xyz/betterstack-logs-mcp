import { describe, it, expect, beforeEach } from 'vitest'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { createTestConfig } from '../../helpers/test-config.js'
import { http, HttpResponse } from 'msw'

describe('Get Source Group Info Tool', () => {
  let client: BetterstackClient

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig())
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
})