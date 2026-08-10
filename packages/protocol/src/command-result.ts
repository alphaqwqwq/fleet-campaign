import type { ProtocolVersion } from './version'
import type { ProtocolErrorCode } from './error-codes'
import type { BroadcastEvent } from './broadcast-event'
import type { Snapshot } from './snapshot'

export interface CommandResultAccepted {
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  senderClientId: string
  kind: 'command-result'
  idempotencyKey: string
  accepted: true
  event: BroadcastEvent
  snapshot: Snapshot
}

export interface CommandResultRejected {
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  senderClientId: string
  kind: 'command-result'
  idempotencyKey: string
  accepted: false
  errorCode: ProtocolErrorCode
  messageKey: string
  sequence: number
}

export type CommandResult = CommandResultAccepted | CommandResultRejected
