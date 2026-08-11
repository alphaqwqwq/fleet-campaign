import { describe, expect, it } from 'vitest'

import { generateSessionToken, isValidSessionToken, sessionTokenFingerprint } from './token'

describe('generateSessionToken', () => {
  it('generates a t_ + 256-bit url-safe token (43 chars)', () => {
    const token = generateSessionToken()
    expect(token).toMatch(/^t_[A-Za-z0-9_-]{43}$/)
    expect(token.length).toBe(45)
  })

  it('generates distinct tokens across calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 100; i += 1) seen.add(generateSessionToken())
    expect(seen.size).toBe(100)
  })
})

describe('isValidSessionToken', () => {
  it('accepts a generated token', () => {
    expect(isValidSessionToken(generateSessionToken())).toBe(true)
  })

  it('rejects malformed tokens', () => {
    expect(isValidSessionToken(undefined)).toBe(false)
    expect(isValidSessionToken(null)).toBe(false)
    expect(isValidSessionToken(123)).toBe(false)
    expect(isValidSessionToken('')).toBe(false)
    expect(isValidSessionToken('t_')).toBe(false)
    expect(isValidSessionToken('x_' + 'a'.repeat(43))).toBe(false)
    expect(isValidSessionToken('t_' + 'a'.repeat(42))).toBe(false)
    expect(isValidSessionToken('t_' + 'a'.repeat(44))).toBe(false)
    expect(isValidSessionToken('t_' + 'a b'.repeat(10) + 'ab')).toBe(false)
    expect(isValidSessionToken('t_' + 'a'.repeat(42) + '+')).toBe(false)
  })
})

describe('sessionTokenFingerprint', () => {
  it('is deterministic for the same token', () => {
    const token = generateSessionToken()
    expect(sessionTokenFingerprint(token)).toBe(sessionTokenFingerprint(token))
  })

  it('differs for distinct tokens and never equals the plaintext token', () => {
    const a = generateSessionToken()
    const b = generateSessionToken()
    expect(sessionTokenFingerprint(a)).not.toBe(sessionTokenFingerprint(b))
    expect(sessionTokenFingerprint(a)).not.toBe(a)
    expect(sessionTokenFingerprint(a)).toMatch(/^[0-9a-f]{32}$/)
  })
})
