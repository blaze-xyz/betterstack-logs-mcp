import { describe, it, expect } from 'vitest'
import { sanitizeSqlString } from '../../../src/tools/query-tools.js'

describe('sanitizeSqlString Function', () => {
  it('should escape single quotes', () => {
    expect(sanitizeSqlString("test'value")).toBe("test''value")
  })

  it('should handle multiple single quotes', () => {
    expect(sanitizeSqlString("user's 'special' data")).toBe("user''s ''special'' data")
  })

  it('should handle SQL injection attempts', () => {
    const maliciousInput = "'; DROP TABLE logs; --"
    const sanitized = sanitizeSqlString(maliciousInput)
    expect(sanitized).toBe("''; DROP TABLE logs; --")
    expect(sanitized).not.toMatch(/^[^']*'[^']*;/)
  })
})