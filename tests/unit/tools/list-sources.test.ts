import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { createTestConfig } from '../../helpers/test-config.js'
import { mockApiSources } from '../../__mocks__/betterstack-responses.js'
import { http, HttpResponse } from 'msw'

describe('List Sources Tool', () => {
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
})