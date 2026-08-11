import { describe, expect, it } from 'vitest'

import type { CommandIntentFrame, JoinRequestFrame, LeaveRequestFrame } from './frames'
import { validateInboundFrame, validateOutboundFrame } from './frames-validate'
import { generateSessionToken } from './token'

const ROOM = 'r_AbCdEfGh1234'
const CLIENT = 'u_12345678-1234-4234-8234-123456789abc'

function joinRequest(overrides: Partial<JoinRequestFrame> = {}): JoinRequestFrame {
  return {
    frame: 'join-request',
    protocolVersion: 1,
    messageId: 'm_1',
    roomId: ROOM,
    clientId: CLIENT,
    requestedRole: 'player',
    ...overrides,
  }
}

function commandIntent(overrides: Partial<CommandIntentFrame> = {}): CommandIntentFrame {
  return {
    frame: 'command-intent',
    protocolVersion: 1,
    messageId: 'm_2',
    roomId: ROOM,
    clientId: CLIENT,
    token: generateSessionToken(),
    intent: {
      protocolVersion: 1,
      messageId: 'm_3',
      roomId: ROOM,
      senderClientId: CLIENT,
      kind: 'command-intent',
      idempotencyKey: 'a'.repeat(22),
      expectedEventSequence: 0,
      command: { type: 'start-demo' },
    },
    ...overrides,
  }
}

function leaveRequest(overrides: Partial<LeaveRequestFrame> = {}): LeaveRequestFrame {
  return {
    frame: 'leave-request',
    protocolVersion: 1,
    messageId: 'm_leave',
    roomId: ROOM,
    clientId: CLIENT,
    token: generateSessionToken(),
    ...overrides,
  }
}

describe('validateInboundFrame', () => {
  it('accepts a valid join-request', () => {
    const result = validateInboundFrame(joinRequest())
    expect(result.ok).toBe(true)
  })

  it('accepts a valid command-intent frame', () => {
    const result = validateInboundFrame(commandIntent())
    expect(result.ok).toBe(true)
  })

  it('accepts a valid leave-request and rejects invalid tokens or unknown fields', () => {
    expect(validateInboundFrame(leaveRequest()).ok).toBe(true)
    expect(validateInboundFrame(leaveRequest({ token: 'bad-token' })).ok).toBe(false)
    expect(validateInboundFrame({ ...leaveRequest(), reason: 'done' }).ok).toBe(false)
  })

  it('rejects a non-object frame', () => {
    expect(validateInboundFrame('nope').ok).toBe(false)
    expect(validateInboundFrame(null).ok).toBe(false)
  })

  it('rejects an unknown frame kind', () => {
    const result = validateInboundFrame({ ...joinRequest(), frame: 'ping' })
    expect(result.ok).toBe(false)
  })

  it('rejects a wrong protocol version', () => {
    const result = validateInboundFrame(joinRequest({ protocolVersion: 2 as never }))
    expect(result.ok).toBe(false)
  })

  it('rejects a bad roomId', () => {
    const result = validateInboundFrame(joinRequest({ roomId: 'r_short' }))
    expect(result.ok).toBe(false)
  })

  it('rejects a bad clientId', () => {
    const result = validateInboundFrame(joinRequest({ clientId: 'not-a-client' }))
    expect(result.ok).toBe(false)
  })

  it('rejects a join-request with an invalid requestedRole', () => {
    const result = validateInboundFrame(joinRequest({ requestedRole: 'admin' as never }))
    expect(result.ok).toBe(false)
  })

  it('rejects unknown fields', () => {
    const result = validateInboundFrame({ ...joinRequest(), hacker: true })
    expect(result.ok).toBe(false)
  })

  it('rejects a command-intent frame with an invalid token', () => {
    const result = validateInboundFrame(commandIntent({ token: 'bad-token' }))
    expect(result.ok).toBe(false)
  })

  it('rejects a command-intent frame without an intent object', () => {
    const result = validateInboundFrame(commandIntent({ intent: 'nope' as never }))
    expect(result.ok).toBe(false)
  })
})

describe('validateOutboundFrame', () => {
  it('accepts leave-accepted and rejects unknown fields', () => {
    const frame = { frame: 'leave-accepted', protocolVersion: 1, messageId: 'm-left', roomId: ROOM, clientId: CLIENT }
    expect(validateOutboundFrame(frame).ok).toBe(true)
    expect(validateOutboundFrame({ ...frame, token: generateSessionToken() }).ok).toBe(false)
  })

  it('accepts room-closed and rejects unknown fields', () => {
    const frame = { frame: 'room-closed', protocolVersion: 1, messageId: 'm-close', roomId: ROOM }
    expect(validateOutboundFrame(frame).ok).toBe(true)
    expect(validateOutboundFrame({ ...frame, token: generateSessionToken() }).ok).toBe(false)
  })

  it('rejects unknown join error codes', () => {
    expect(validateOutboundFrame({
      frame: 'join-rejected', protocolVersion: 1, messageId: 'm-reject', roomId: ROOM,
      clientId: CLIENT, errorCode: 'admin_required', messageKey: 'realtime.error',
    }).ok).toBe(false)
  })
})
