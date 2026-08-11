import type { CommandIntent } from './command-intent'
import { INTENT_COMMAND_TYPES } from './command-intent'
import type { CommandResult } from './command-result'
import type { BroadcastEvent } from './broadcast-event'
import { BROADCAST_EVENT_TYPES } from './broadcast-event'
import type { BroadcastEventType } from './broadcast-event'
import type { Snapshot } from './snapshot'
import { ROSTER_ROLES, VISIBILITIES } from './snapshot'
import { PROTOCOL_VERSION } from './version'
import { isProtocolErrorCode } from './error-codes'
import {
  isValidCampaignId,
  isValidClientId,
  isValidEventId,
  isValidIdempotencyKey,
  isValidMessageId,
  isValidRoomId,
} from './ids'

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] }

type UnknownRecord = Record<string, unknown>

const PHASES = ['awaiting-player', 'active', 'completed', 'closed']
const SEATS = ['host', 'guest']

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

function validateNonNegativeInt(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    errors.push(`${field} must be a non-negative integer`)
  }
}

function validateSeat(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== 'string' || !SEATS.includes(value)) {
    errors.push(`${field} must be host or guest`)
  }
}

/** 每种已批准事件类型只允许其领域事实映射的公开载荷字段，未知字段一律拒绝。 */
const PUBLIC_PAYLOAD_FIELDS: Record<BroadcastEventType, readonly string[]> = {
  'demo-started': ['round', 'activeSeat'],
  'action-confirmed': ['targetSeat', 'targetIntegrity'],
  'demo-completed': ['winnerSeat'],
  'room-closed': [],
}

function validatePublicPayload(type: BroadcastEventType, payload: UnknownRecord, errors: string[]): void {
  const allowed = PUBLIC_PAYLOAD_FIELDS[type]
  rejectUnknownKeys(payload, allowed, errors)
  for (const field of allowed) {
    if (payload[field] === undefined) {
      errors.push(`publicPayload.${field} must be present for ${type}`)
    }
  }
  if (allowed.includes('round')) {
    validateNonNegativeInt(payload.round, 'publicPayload.round', errors)
  }
  if (allowed.includes('activeSeat')) {
    validateSeat(payload.activeSeat, 'publicPayload.activeSeat', errors)
  }
  if (allowed.includes('targetSeat')) {
    validateSeat(payload.targetSeat, 'publicPayload.targetSeat', errors)
  }
  if (allowed.includes('targetIntegrity')) {
    validateNonNegativeInt(payload.targetIntegrity, 'publicPayload.targetIntegrity', errors)
  }
  if (allowed.includes('winnerSeat')) {
    validateSeat(payload.winnerSeat, 'publicPayload.winnerSeat', errors)
  }
}

function validateEnvelopeCore(record: UnknownRecord, allowed: readonly string[], errors: string[]): void {
  if (record.protocolVersion !== PROTOCOL_VERSION) {
    errors.push('protocolVersion must be 1')
  }
  if (!isValidMessageId(record.messageId)) {
    errors.push('messageId must be a non-empty string')
  }
  if (!isValidRoomId(record.roomId)) {
    errors.push('roomId must match r_ + 12 url-safe characters')
  }
  if (!isValidClientId(record.senderClientId)) {
    errors.push('senderClientId must match u_ + uuid')
  }
  rejectUnknownKeys(record, allowed, errors)
}

function validateGameView(game: UnknownRecord, errors: string[]): void {
  if (game.contentId !== 'demo-v1') {
    errors.push('game.contentId must be "demo-v1"')
  }
  if (typeof game.phase !== 'string' || !PHASES.includes(game.phase)) {
    errors.push('game.phase must be one of awaiting-player, active, completed, closed')
  }
  validateNonNegativeInt(game.round, 'game.round', errors)
  if (game.activeSeat !== null && !SEATS.includes(game.activeSeat as string)) {
    errors.push('game.activeSeat must be host, guest or null')
  }
  validateNonNegativeInt(game.actionPoints, 'game.actionPoints', errors)
  if (!Array.isArray(game.units)) {
    errors.push('game.units must be an array')
  } else {
    game.units.forEach((unit, index) => {
      if (!isRecord(unit)) {
        errors.push(`game.units[${index}] must be an object`)
        return
      }
      if (unit.id !== 'host-unit' && unit.id !== 'guest-unit') {
        errors.push(`game.units[${index}].id must be host-unit or guest-unit`)
      }
      validateNonNegativeInt(unit.integrity, `game.units[${index}].integrity`, errors)
      rejectUnknownKeys(unit, ['id', 'integrity'], errors)
    })
  }
  if (game.winnerSeat !== null && !SEATS.includes(game.winnerSeat as string)) {
    errors.push('game.winnerSeat must be host, guest or null')
  }
  rejectUnknownKeys(game, [
    'contentId',
    'phase',
    'round',
    'activeSeat',
    'actionPoints',
    'units',
    'winnerSeat',
  ], errors)
}

/**
 * 最小本地运行时校验器（无新增运行时依赖）：未知版本、未知字段语义或
 * schema 不合法的数据一律不进入领域层，返回 protocol_invalid 语义的确定性错误。
 */
export function validateCommandIntent(input: unknown): Validation<CommandIntent> {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['command-intent must be an object'] }

  validateEnvelopeCore(input, [
    'protocolVersion',
    'messageId',
    'roomId',
    'senderClientId',
    'kind',
    'idempotencyKey',
    'expectedEventSequence',
    'command',
  ], errors)
  if (input.kind !== 'command-intent') {
    errors.push('kind must be "command-intent"')
  }
  if (!isValidIdempotencyKey(input.idempotencyKey)) {
    errors.push('idempotencyKey must be a url-safe 128-bit key of 22-32 characters')
  }
  validateNonNegativeInt(input.expectedEventSequence, 'expectedEventSequence', errors)
  if (!isRecord(input.command)) {
    errors.push('command must be an object')
  } else {
    if (!INTENT_COMMAND_TYPES.includes(input.command.type as never)) {
      errors.push(`command.type must be one of ${INTENT_COMMAND_TYPES.join(', ')}`)
    }
    rejectUnknownKeys(input.command, ['type'], errors)
  }

  return finish(errors, input)
}

export function validateBroadcastEvent(input: unknown): Validation<BroadcastEvent> {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['broadcast-event must be an object'] }

  if (input.protocolVersion !== PROTOCOL_VERSION) {
    errors.push('protocolVersion must be 1')
  }
  if (!isValidRoomId(input.roomId)) {
    errors.push('roomId must match r_ + 12 url-safe characters')
  }
  validateNonNegativeInt(input.eventSequence, 'eventSequence', errors)
  if (!isValidEventId(input.eventId)) {
    errors.push('eventId must match e_ + url-safe characters')
  }
  if (!BROADCAST_EVENT_TYPES.includes(input.type as never)) {
    errors.push(`type must be one of ${BROADCAST_EVENT_TYPES.join(', ')}`)
  }
  if (input.actorSeat !== undefined && !SEATS.includes(input.actorSeat as string)) {
    errors.push('actorSeat must be host or guest when present')
  }
  if (!isRecord(input.publicPayload)) {
    errors.push('publicPayload must be an object')
  } else if (BROADCAST_EVENT_TYPES.includes(input.type as never)) {
    validatePublicPayload(input.type as BroadcastEventType, input.publicPayload, errors)
  }
  rejectUnknownKeys(input, [
    'protocolVersion',
    'roomId',
    'eventSequence',
    'eventId',
    'type',
    'actorSeat',
    'publicPayload',
  ], errors)

  return finish(errors, input)
}

export function validateSnapshot(input: unknown): Validation<Snapshot> {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['snapshot must be an object'] }

  if (input.protocolVersion !== PROTOCOL_VERSION) {
    errors.push('protocolVersion must be 1')
  }
  if (!isValidRoomId(input.roomId)) {
    errors.push('roomId must match r_ + 12 url-safe characters')
  }
  if (!isValidCampaignId(input.campaignId)) {
    errors.push('campaignId must match c_ + uuid')
  }
  validateNonNegativeInt(input.eventSequence, 'eventSequence', errors)
  if (!isRecord(input.game)) {
    errors.push('game must be an object')
  } else {
    validateGameView(input.game, errors)
  }
  if (!Array.isArray(input.roster)) {
    errors.push('roster must be an array')
  } else {
    input.roster.forEach((entry, index) => {
      if (!isRecord(entry)) {
        errors.push(`roster[${index}] must be an object`)
        return
      }
      if (!isValidClientId(entry.clientId)) {
        errors.push(`roster[${index}].clientId must match u_ + uuid`)
      }
      if (!SEATS.includes(entry.seat as string)) {
        errors.push(`roster[${index}].seat must be host or guest`)
      }
      if (!ROSTER_ROLES.includes(entry.role as never)) {
        errors.push(`roster[${index}].role must be one of ${ROSTER_ROLES.join(', ')}`)
      }
      rejectUnknownKeys(entry, ['clientId', 'seat', 'role'], errors)
    })
  }
  if (!VISIBILITIES.includes(input.visibility as never)) {
    errors.push(`visibility must be one of ${VISIBILITIES.join(', ')}`)
  }
  rejectUnknownKeys(input, [
    'protocolVersion',
    'roomId',
    'campaignId',
    'eventSequence',
    'game',
    'roster',
    'visibility',
  ], errors)

  return finish(errors, input)
}

export function validateCommandResult(input: unknown): Validation<CommandResult> {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['command-result must be an object'] }

  validateEnvelopeCore(input, [
    'protocolVersion',
    'messageId',
    'roomId',
    'senderClientId',
    'kind',
    'idempotencyKey',
    'accepted',
    'event',
    'snapshot',
    'errorCode',
    'messageKey',
    'sequence',
  ], errors)
  if (input.kind !== 'command-result') {
    errors.push('kind must be "command-result"')
  }
  if (!isValidIdempotencyKey(input.idempotencyKey)) {
    errors.push('idempotencyKey must be a url-safe string of 1-32 characters')
  }
  if (input.accepted === true) {
    const event = validateBroadcastEvent(input.event)
    if (!event.ok) errors.push(...event.errors.map((message) => `event: ${message}`))
    const snapshot = validateSnapshot(input.snapshot)
    if (!snapshot.ok) errors.push(...snapshot.errors.map((message) => `snapshot: ${message}`))
  } else if (input.accepted === false) {
    if (!isProtocolErrorCode(input.errorCode)) {
      errors.push('errorCode must be a known protocol error code')
    }
    if (typeof input.messageKey !== 'string' || input.messageKey.length === 0) {
      errors.push('messageKey must be a non-empty string')
    }
    validateNonNegativeInt(input.sequence, 'sequence', errors)
  } else {
    errors.push('accepted must be a boolean')
  }

  return finish(errors, input)
}

function finish<T>(errors: string[], value: unknown): Validation<T> {
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, value: value as T }
}
