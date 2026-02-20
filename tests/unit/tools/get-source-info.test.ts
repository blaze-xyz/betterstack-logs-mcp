import { describe, it, expect, beforeEach } from 'vitest'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { createTestConfig } from '../../helpers/test-config.js'

describe('Get Source Info Tool', () => {
  let client: BetterstackClient

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig())
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
      const sourceInfo = await client.getSourceInfo("Production API Server")

      expect(sourceInfo).toBeTruthy()
      expect(sourceInfo?.id).toBe("1021716")
      expect(sourceInfo?.platform).toBe("linux")
      expect(sourceInfo?.retention_days).toBe(30)
    })

    it('should prefer ID match over name match', async () => {
      const sourceInfo = await client.getSourceInfo("1021715")

      expect(sourceInfo).toBeTruthy()
      expect(sourceInfo?.name).toBe("Spark - staging | deprecated")
    })
  })
})