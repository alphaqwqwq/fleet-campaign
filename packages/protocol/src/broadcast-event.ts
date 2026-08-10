import type { SeatId } from '@fleet-campaign/domain'

import type { ProtocolVersion } from './version'

export const BROADCAST_EVENT_TYPES = [
  'demo-started',
  'action-confirmed',
  'demo-completed',
  'room-closed',
] as const

export type BroadcastEventType = (typeof BROADCAST_EVENT_TYPES)[number]

/**
 * 房主下行广播事件。`eventId` 仅作日志/渲染键，排序唯一依据为
 * `eventSequence`；没有客户端时间作为规则输入。
 */
export interface BroadcastEvent {
  protocolVersion: ProtocolVersion
  roomId: string
  eventSequence: number
  eventId: string
  type: BroadcastEventType
  actorSeat?: SeatId
  publicPayload: Record<string, unknown>
}
