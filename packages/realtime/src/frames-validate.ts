import {
  isValidClientId,
  isValidMessageId,
  isValidRoomId,
  PROTOCOL_VERSION,
  ROSTER_ROLES,
  validateBroadcastEvent,
  validateCommandResult,
  validateSnapshot,
  type Validation,
} from '@fleet-campaign/protocol'

import { JOIN_ERROR_CODES, REQUESTED_ROLES, type ClientToHostFrame, type HostToClientFrame } from './frames'
import { isValidSessionToken } from './token'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rejectUnknownKeys(record: UnknownRecord, allowed: readonly string[], errors: string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      errors.push(`unknown field "${key}"`)
    }
  }
}

/**
 * 传输层对客户端上行帧的外层信封校验：只校验帧类型、版本与身份字段格式。
 * protocol v1 信封（如 `CommandIntent` 的 command/幂等键/序列）由应用服务
 * 在裁决链第一步做 schema 校验，从而可对非法意图返回 `protocol_invalid`。
 * 校验失败的外层帧没有可安全回复的身份，直接丢弃，不进入应用服务。
 */
export function validateInboundFrame(input: unknown): Validation<ClientToHostFrame> {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['frame must be an object'] }

  const frame = input.frame
  if (frame !== 'join-request' && frame !== 'command-intent' && frame !== 'leave-request') {
    return { ok: false, errors: ['frame must be join-request, command-intent, or leave-request'] }
  }
  if (input.protocolVersion !== PROTOCOL_VERSION) {
    errors.push('protocolVersion must be 1')
  }
  if (!isValidMessageId(input.messageId)) {
    errors.push('messageId must be a non-empty string')
  }
  if (!isValidRoomId(input.roomId)) {
    errors.push('roomId must match r_ + 12 url-safe characters')
  }
  if (!isValidClientId(input.clientId)) {
    errors.push('clientId must match u_ + uuid')
  }

  if (frame === 'join-request') {
    rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId', 'requestedRole', 'token'], errors)
    if (!REQUESTED_ROLES.includes(input.requestedRole as never)) {
      errors.push('requestedRole must be player or spectator')
    }
    if (input.token !== undefined && !isValidSessionToken(input.token)) {
      errors.push('token must be a valid session token when present')
    }
  } else if (frame === 'command-intent') {
    rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId', 'token', 'intent'], errors)
    if (!isValidSessionToken(input.token)) {
      errors.push('token must be a valid session token')
    }
    if (!isRecord(input.intent)) {
      errors.push('intent must be an object')
    }
  } else {
    rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId', 'token'], errors)
    if (!isValidSessionToken(input.token)) {
      errors.push('token must be a valid session token')
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, value: input as unknown as ClientToHostFrame }
}

export function validateOutboundFrame(input: unknown): Validation<HostToClientFrame> {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['frame must be an object'] }
  if (input.protocolVersion !== PROTOCOL_VERSION) errors.push('protocolVersion must be 1')
  if (!isValidMessageId(input.messageId)) errors.push('messageId must be a non-empty string')
  if (!isValidRoomId(input.roomId)) errors.push('roomId must match r_ + 12 url-safe characters')

  switch (input.frame) {
    case 'join-accepted':
      rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId', 'token', 'role', 'seat'], errors)
      if (!isValidClientId(input.clientId)) errors.push('clientId must match u_ + uuid')
      if (!isValidSessionToken(input.token)) errors.push('token must be a valid session token')
      if (!ROSTER_ROLES.includes(input.role as never) || input.role === 'host') errors.push('role must be player or spectator')
      if (input.seat !== 'guest' && input.seat !== null) errors.push('seat must be guest or null')
      break
    case 'join-rejected':
      rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId', 'errorCode', 'messageKey'], errors)
      if (!isValidClientId(input.clientId)) errors.push('clientId must match u_ + uuid')
      if (!JOIN_ERROR_CODES.includes(input.errorCode as never)) errors.push('errorCode must be a known join error code')
      if (typeof input.messageKey !== 'string' || input.messageKey.length === 0) errors.push('messageKey must be non-empty')
      break
    case 'leave-accepted':
      rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId'], errors)
      if (!isValidClientId(input.clientId)) errors.push('clientId must match u_ + uuid')
      break
    case 'command-result': {
      rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId', 'result'], errors)
      if (!isValidClientId(input.clientId)) errors.push('clientId must match u_ + uuid')
      const result = validateCommandResult(input.result)
      if (!result.ok) errors.push(...result.errors.map((error) => `result: ${error}`))
      break
    }
    case 'broadcast-event': {
      rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'event'], errors)
      const event = validateBroadcastEvent(input.event)
      if (!event.ok) errors.push(...event.errors.map((error) => `event: ${error}`))
      break
    }
    case 'snapshot': {
      rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId', 'snapshot'], errors)
      if (!isValidClientId(input.clientId)) errors.push('clientId must match u_ + uuid')
      const snapshot = validateSnapshot(input.snapshot)
      if (!snapshot.ok) errors.push(...snapshot.errors.map((error) => `snapshot: ${error}`))
      break
    }
    case 'room-closed':
      rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId'], errors)
      break
    case 'duplicate-connection':
      rejectUnknownKeys(input, ['frame', 'protocolVersion', 'messageId', 'roomId', 'clientId'], errors)
      if (!isValidClientId(input.clientId)) errors.push('clientId must match u_ + uuid')
      break
    default:
      errors.push('unknown outbound frame')
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: input as unknown as HostToClientFrame }
}
