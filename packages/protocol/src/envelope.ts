import type { ProtocolVersion } from './version'

export const ENVELOPE_KINDS = ['command-intent', 'command-result'] as const

export type EnvelopeKind = (typeof ENVELOPE_KINDS)[number]

/**
 * 传输信封公共字段。`messageId` 仅用于传输诊断，房主不得把它当作
 * 游戏命令幂等键；`senderClientId` 由连接绑定解析，不能信任命令体自报席位。
 */
export interface EnvelopeBase {
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  senderClientId: string
  kind: EnvelopeKind
}
