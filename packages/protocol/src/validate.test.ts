import { describe, expect, it } from 'vitest'

import { DEMO_V1_CONTENT } from '@fleet-campaign/content'
import { createInitialState, reduceCommand } from '@fleet-campaign/domain'

import {
  isValidIdempotencyKey,
  PROTOCOL_ERROR_CODES,
  projectGame,
  validateBroadcastEvent,
  validateCommandIntent,
  validateCommandResult,
  validateSnapshot,
} from './index'
import type { CommandIntent } from './index'

const ROOM_ID = 'r_abcdEFGHij12'
const CLIENT_ID = 'u_12345678-1234-1234-1234-123456789abc'
const CAMPAIGN_ID = 'c_12345678-1234-1234-1234-123456789abc'
const MESSAGE_ID = 'm_001'
const KEY = 'ab12_CD-ef'

function startedGame() {
  const initial = createInitialState(DEMO_V1_CONTENT)
  if (!initial.ok) throw new Error('fixture must be valid')
  const started = reduceCommand(initial.state, { type: 'start-demo', actorSeat: 'host' })
  if (started.kind !== 'accepted') throw new Error('start-demo must succeed')
  return started.state
}

function validIntent(overrides: Partial<CommandIntent> = {}): CommandIntent {
  return {
    protocolVersion: 1,
    messageId: MESSAGE_ID,
    roomId: ROOM_ID,
    senderClientId: CLIENT_ID,
    kind: 'command-intent',
    idempotencyKey: KEY,
    expectedEventSequence: 0,
    command: { type: 'start-demo' },
    ...overrides,
  }
}

function validBroadcastEvent() {
  return {
    protocolVersion: 1,
    roomId: ROOM_ID,
    eventSequence: 1,
    eventId: 'e_event-1',
    type: 'demo-started',
    actorSeat: 'host',
    publicPayload: { round: 1 },
  }
}

function validSnapshot() {
  return {
    protocolVersion: 1,
    roomId: ROOM_ID,
    campaignId: CAMPAIGN_ID,
    eventSequence: 1,
    game: projectGame(startedGame()),
    roster: [{ clientId: CLIENT_ID, seat: 'host', role: 'host' }],
    visibility: 'host',
  }
}

describe('validateCommandIntent', () => {
  it('accepts a valid start-demo intent', () => {
    const result = validateCommandIntent(validIntent())
    expect(result.ok).toBe(true)
  })

  it('accepts a valid advance intent', () => {
    const result = validateCommandIntent(validIntent({ command: { type: 'advance' } }))
    expect(result.ok).toBe(true)
  })

  it('rejects an unknown protocol version', () => {
    const result = validateCommandIntent(validIntent({ protocolVersion: 2 as never }))
    expect(result.ok).toBe(false)
  })

  it('rejects unknown envelope fields', () => {
    const result = validateCommandIntent({ ...validIntent(), secret: 'token' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('secret')
  })

  it('rejects an invalid kind', () => {
    const result = validateCommandIntent(validIntent({ kind: 'command-result' as never }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('kind')
  })

  it('rejects an invalid roomId', () => {
    const result = validateCommandIntent(validIntent({ roomId: 'not-a-room' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('roomId')
  })

  it('rejects an invalid senderClientId', () => {
    const result = validateCommandIntent(validIntent({ senderClientId: 'host' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('senderClientId')
  })

  it.each([
    ['empty', ''],
    ['too long', 'a'.repeat(33)],
    ['unsafe characters', 'abc def'],
  ])('rejects an idempotencyKey that is %s', (_label, key) => {
    const result = validateCommandIntent(validIntent({ idempotencyKey: key }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('idempotencyKey')
  })

  it('rejects a negative expectedEventSequence', () => {
    const result = validateCommandIntent(validIntent({ expectedEventSequence: -1 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('expectedEventSequence')
  })

  it('rejects a fractional expectedEventSequence', () => {
    const result = validateCommandIntent(validIntent({ expectedEventSequence: 1.5 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('expectedEventSequence')
  })

  it('rejects an unknown command type', () => {
    const result = validateCommandIntent(validIntent({ command: { type: 'move' as never } }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('command.type')
  })

  it('rejects unknown command fields', () => {
    const result = validateCommandIntent(
      validIntent({ command: { type: 'advance', target: 'host' } as never }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('target')
  })

  it('rejects non-object input', () => {
    expect(validateCommandIntent(null).ok).toBe(false)
  })
})

describe('validateBroadcastEvent', () => {
  it('accepts a valid broadcast event', () => {
    const result = validateBroadcastEvent(validBroadcastEvent())
    expect(result.ok).toBe(true)
  })

  it('rejects an unknown event type', () => {
    const result = validateBroadcastEvent({ ...validBroadcastEvent(), type: 'moved' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('type')
  })

  it('rejects a negative eventSequence', () => {
    const result = validateBroadcastEvent({ ...validBroadcastEvent(), eventSequence: -1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('eventSequence')
  })

  it('rejects an invalid eventId', () => {
    const result = validateBroadcastEvent({ ...validBroadcastEvent(), eventId: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('eventId')
  })

  it('rejects an invalid actorSeat', () => {
    const result = validateBroadcastEvent({ ...validBroadcastEvent(), actorSeat: 'spectator' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('actorSeat')
  })

  it('rejects a missing publicPayload', () => {
    const result = validateBroadcastEvent({ ...validBroadcastEvent(), publicPayload: undefined })
    expect(result.ok).toBe(false)
  })
})

describe('validateSnapshot', () => {
  it('accepts a valid full snapshot', () => {
    const result = validateSnapshot(validSnapshot())
    expect(result.ok).toBe(true)
  })

  it('rejects an invalid campaignId', () => {
    const result = validateSnapshot({ ...validSnapshot(), campaignId: ROOM_ID })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('campaignId')
  })

  it('rejects a roster entry that carries a token field', () => {
    const result = validateSnapshot({
      ...validSnapshot(),
      roster: [{ clientId: CLIENT_ID, seat: 'host', role: 'host', token: 't_secret' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('token')
  })

  it('rejects an unknown visibility', () => {
    const result = validateSnapshot({ ...validSnapshot(), visibility: 'admin' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('visibility')
  })

  it('rejects an invalid game projection', () => {
    const result = validateSnapshot({
      ...validSnapshot(),
      game: { ...validSnapshot().game, phase: 'paused' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('game.phase')
  })
})

describe('validateCommandResult', () => {
  it('accepts an accepted result with event and snapshot', () => {
    const result = validateCommandResult({
      protocolVersion: 1,
      messageId: MESSAGE_ID,
      roomId: ROOM_ID,
      senderClientId: CLIENT_ID,
      kind: 'command-result',
      idempotencyKey: KEY,
      accepted: true,
      event: validBroadcastEvent(),
      snapshot: validSnapshot(),
    })
    expect(result.ok).toBe(true)
  })

  it('accepts a rejected result with a stable error code', () => {
    const result = validateCommandResult({
      protocolVersion: 1,
      messageId: MESSAGE_ID,
      roomId: ROOM_ID,
      senderClientId: CLIENT_ID,
      kind: 'command-result',
      idempotencyKey: KEY,
      accepted: false,
      errorCode: 'phase_mismatch',
      messageKey: 'error.phaseMismatch',
      sequence: 1,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects an unknown errorCode on a rejected result', () => {
    const result = validateCommandResult({
      protocolVersion: 1,
      messageId: MESSAGE_ID,
      roomId: ROOM_ID,
      senderClientId: CLIENT_ID,
      kind: 'command-result',
      idempotencyKey: KEY,
      accepted: false,
      errorCode: 'server_error',
      messageKey: 'error.server',
      sequence: 1,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('errorCode')
  })

  it('rejects a non-boolean accepted', () => {
    const result = validateCommandResult({
      ...validSnapshot(),
      accepted: 'yes',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('accepted')
  })
})

describe('isValidIdempotencyKey', () => {
  it('accepts url-safe keys up to 32 chars', () => {
    expect(isValidIdempotencyKey('a')).toBe(true)
    expect(isValidIdempotencyKey('A_-09z'.repeat(5).slice(0, 32))).toBe(true)
  })

  it('rejects empty, oversized and unsafe keys', () => {
    expect(isValidIdempotencyKey('')).toBe(false)
    expect(isValidIdempotencyKey('a'.repeat(33))).toBe(false)
    expect(isValidIdempotencyKey('has space')).toBe(false)
    expect(isValidIdempotencyKey(42)).toBe(false)
  })
})

describe('protocol error codes', () => {
  it('covers all plan-specified error codes', () => {
    expect(PROTOCOL_ERROR_CODES).toEqual([
      'protocol_invalid',
      'room_not_found',
      'room_mismatch',
      'identity_invalid',
      'forbidden_role',
      'state_conflict',
      'phase_mismatch',
      'not_active_seat',
      'command_invalid',
      'room_closed',
      'transport_unavailable',
    ])
  })
})
