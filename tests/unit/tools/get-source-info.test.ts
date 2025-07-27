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
      const sources = await client.listSources()
      const targetSource = sources.find(s => s.name === "Production API Server")
      
      expect(targetSource).toBeTruthy()
      expect(targetSource?.platform).toBe("linux")
      expect(targetSource?.retention_days).toBe(30)
    })
  })
})