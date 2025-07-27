import { describe, it, expect } from 'vitest'
import { validateJsonFieldFilter } from '../../../src/tools/query-tools.js'

describe('validateJsonFieldFilter Function', () => {
  it('should validate valid JSON field filter', () => {
    const jsonField = { path: 'user.id', value: '12345' }
    expect(() => validateJsonFieldFilter(jsonField)).not.toThrow()
  })

  it('should reject invalid path format', () => {
    const jsonField = { path: '.invalid', value: '12345' }
    expect(() => validateJsonFieldFilter(jsonField)).toThrow('Invalid JSON path format')
  })
})