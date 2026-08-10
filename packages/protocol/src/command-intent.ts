import type { ProtocolVersion } from './version'

export const INTENT_COMMAND_TYPES = ['start-demo', 'advance'] as const

export type IntentCommandType = (typeof INTENT_COMMAND_TYPES)[number]

/** 客户端上行命令意图：只携带无结果的行动类型，结果与结论由房主裁决。 */
export interface CommandIntent {
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  senderClientId: string
  kind: 'command-intent'
  idempotencyKey: string
  expectedEventSequence: number
  command: { type: IntentCommandType }
}
