import type {
  BroadcastEvent,
  CommandIntent,
  CommandResult,
  ProtocolVersion,
  RosterRole,
  Snapshot,
} from '@fleet-campaign/protocol'

type PublicSeat = Snapshot['roster'][number]['seat']

export const REQUESTED_ROLES = ['player', 'spectator'] as const

export type RequestedRole = (typeof REQUESTED_ROLES)[number]

/**
 * 加入握手阶段的传输级错误码。握手发生在任何 protocol v1 信封之前，
 * 因此不扩张 protocol v1 的 `PROTOCOL_ERROR_CODES`。
 */
export const JOIN_ERROR_CODES = [
  'protocol_invalid',
  'room_not_found',
  'room_closed',
  'identity_invalid',
  'player_seat_unavailable',
  'forbidden_role',
  'transport_unavailable',
] as const

export type JoinErrorCode = (typeof JOIN_ERROR_CODES)[number]

/** 客户端上行：首次握手不携带令牌；重连必须携带仍有效的原令牌。 */
export interface JoinRequestFrame {
  frame: 'join-request'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  clientId: string
  requestedRole: RequestedRole
  token?: string
}

/**
 * 客户端上行：受保护命令意图。`token` 为每次受保护消息携带的会话令牌，
 * 与协议 v1 信封分离（协议 v1 不含令牌字段）；`intent` 为 protocol v1 信封。
 */
export interface CommandIntentFrame {
  frame: 'command-intent'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  clientId: string
  token: string
  intent: CommandIntent
}

/** 客户端上行：显式离开并撤销当前连接绑定的会话令牌。 */
export interface LeaveRequestFrame {
  frame: 'leave-request'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  clientId: string
  token: string
}

/** 房主下行：加入接受。`token` 只在握手下发，随后由客户端在受保护消息中携带。 */
export interface JoinAcceptedFrame {
  frame: 'join-accepted'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  clientId: string
  token: string
  role: RosterRole
  seat: PublicSeat | null
}

/** 房主下行：加入拒绝（传输级错误码）。 */
export interface JoinRejectedFrame {
  frame: 'join-rejected'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  clientId: string
  errorCode: JoinErrorCode
  messageKey: string
}

/** 房主下行：对命令意图的裁决结果，`result` 为 protocol v1 信封。 */
export interface CommandResultFrame {
  frame: 'command-result'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  clientId: string
  result: CommandResult
}

/** 房主下行：有序广播事件，`event` 为 protocol v1 信封。 */
export interface BroadcastEventFrame {
  frame: 'broadcast-event'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  event: BroadcastEvent
}

/** 房主下行：完整快照，`snapshot` 为 protocol v1 信封。 */
export interface SnapshotFrame {
  frame: 'snapshot'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  clientId: string
  snapshot: Snapshot
}

/** 房主下行：会话结束广播，之后不提供房主迁移。 */
export interface RoomClosedFrame {
  frame: 'room-closed'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
}

/** 房主下行：同一 clientId 被更新连接替换时的可观察状态。 */
export interface DuplicateConnectionFrame {
  frame: 'duplicate-connection'
  protocolVersion: ProtocolVersion
  messageId: string
  roomId: string
  clientId: string
}

export type ClientToHostFrame = JoinRequestFrame | CommandIntentFrame | LeaveRequestFrame

export type HostToClientFrame =
  | JoinAcceptedFrame
  | JoinRejectedFrame
  | CommandResultFrame
  | BroadcastEventFrame
  | SnapshotFrame
  | RoomClosedFrame
  | DuplicateConnectionFrame

export type WireFrame = ClientToHostFrame | HostToClientFrame

export function isClientToHostFrame(frame: WireFrame): frame is ClientToHostFrame {
  return frame.frame === 'join-request' || frame.frame === 'command-intent' || frame.frame === 'leave-request'
}
