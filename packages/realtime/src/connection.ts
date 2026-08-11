import type { ClientToHostFrame, HostToClientFrame } from './frames'

/** 房主端点状态。 */
export type HostStatus = 'starting' | 'open' | 'closed' | 'transport_unavailable'

/** 客户端连接状态。`duplicate_connection` 是同一 clientId 被替换时的可观察终态。 */
export type ClientStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'closed'
  | 'duplicate_connection'
  | 'transport_unavailable'

export interface HostTransportEvents {
  onOpen(): void
  onClose(): void
  onClientConnect(connectionId: string): void
  onClientDisconnect(connectionId: string): void
  onFrame(connectionId: string, frame: ClientToHostFrame): void
  onUnavailable(reason: string): void
}

export interface ClientTransportEvents {
  onStatus(status: ClientStatus): void
  onFrame(frame: HostToClientFrame): void
}

/**
 * 房主端点传输抽象：把 `roomId` 映射为当前临时端点，接受多条客户连接。
 * 传输层不做规则结算、快照篡改或身份授权决策；帧按外向形状校验后透传。
 */
export interface HostTransport {
  readonly status: HostStatus
  setEvents(events: HostTransportEvents): void
  open(roomId: string): void
  sendTo(connectionId: string, frame: HostToClientFrame): boolean
  broadcast(frame: HostToClientFrame): void
  closeClient(connectionId: string): void
  close(): void
}

/** 客户端传输抽象：按 `roomId` 拨号房主端点并建立唯一连接。 */
export interface ClientTransport {
  readonly status: ClientStatus
  setEvents(events: ClientTransportEvents): void
  connect(roomId: string): void
  send(frame: ClientToHostFrame): boolean
  close(): void
}
