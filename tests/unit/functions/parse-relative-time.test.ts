import { describe, it, expect } from 'vitest'
import { parseRelativeTime } from '../../../src/tools/query-tools.js'

describe('parseRelativeTime Function', () => {
  it('should parse compact format', () => {
    expect(parseRelativeTime('1h')).toBe('dt >= now() - INTERVAL 1 HOUR')
    expect(parseRelativeTime('30m')).toBe('dt >= now() - INTERVAL 30 MINUTE')
    expect(parseRelativeTime('2d')).toBe('dt >= now() - INTERVAL 2 DAY')
  })

  it('should parse natural language format', () => {
    expect(parseRelativeTime('1 hour')).toBe('dt >= now() - INTERVAL 1 HOUR')
    expect(parseRelativeTime('30 minutes')).toBe('dt >= now() - INTERVAL 30 MINUTE')
  })

  it('should return null for invalid formats', () => {
    expect(parseRelativeTime('invalid')).toBeNull()
    expect(parseRelativeTime('1x')).toBeNull()
  })
})