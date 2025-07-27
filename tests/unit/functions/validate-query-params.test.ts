import { describe, it, expect } from 'vitest'
import { validateQueryParams, type StructuredQueryParams } from '../../../src/tools/query-tools.js'

describe('validateQueryParams Function', () => {
  it('should validate valid parameters', () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'raw'],
      limit: 10
    }

    expect(() => validateQueryParams(params)).not.toThrow()
  })

  it('should reject invalid fields', () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'invalid_field'],
      limit: 10
    }

    expect(() => validateQueryParams(params)).toThrow('Invalid fields: invalid_field')
  })

  it('should reject invalid limit (too low)', () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'raw'],
      limit: 0
    }

    expect(() => validateQueryParams(params)).toThrow('Invalid limit: 0. Must be between 1 and 1000')
  })

  it('should reject invalid limit (too high)', () => {
    const params: StructuredQueryParams = {
      fields: ['dt', 'raw'],
      limit: 1001
    }

    expect(() => validateQueryParams(params)).toThrow('Invalid limit: 1001. Must be between 1 and 1000')
  })
})