import { describe, it, expect } from 'vitest'
import { parseTimeValue } from '../../../src/tools/query-tools.js'

describe('parseTimeValue Function', () => {
  it('should parse ISO date format', () => {
    expect(parseTimeValue('2024-01-15', 'start')).toBe("dt >= '2024-01-15'")
    expect(parseTimeValue('2024-01-15', 'end')).toBe("dt <= '2024-01-15'")
  })

  it('should return null for invalid formats', () => {
    expect(parseTimeValue('invalid-date', 'start')).toBeNull()
    expect(parseTimeValue('not-a-date', 'end')).toBeNull()
  })

  it('should accept format-valid dates (semantic validation is database responsibility)', () => {
    expect(parseTimeValue('2024-13-01', 'start')).toBe("dt >= '2024-13-01'")
  })
})