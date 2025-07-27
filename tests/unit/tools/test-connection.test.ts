import { describe, it, expect, beforeEach } from 'vitest'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { createTestConfig } from '../../helpers/test-config.js'
import { http, HttpResponse } from 'msw'

describe('Test Connection Tool', () => {
  let client: BetterstackClient

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig())
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