import { describe, it, expect } from 'vitest'
import { validateQueryParams, type StructuredQueryParams } from '../../../src/tools/query-tools.js'

describe('validateQueryParams Function', () => {
  it('should validate valid parameters', () => {
    const params: StructuredQueryParams = {
      limit: 10
    }

    expect(() => validateQueryParams(params)).not.toThrow()
  })

  it('should reject invalid limit (too low)', () => {
    const params: StructuredQueryParams = {
      limit: 0
    }

    expect(() => validateQueryParams(params)).toThrow('Invalid limit: 0. Must be between 1 and 1000')
  })

  it('should reject invalid limit (too high)', () => {
    const params: StructuredQueryParams = {
      limit: 1001
    }

    expect(() => validateQueryParams(params)).toThrow('Invalid limit: 1001. Must be between 1 and 1000')
  })
})