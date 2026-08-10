export type SeatId = 'host' | 'guest'

export type Phase = 'awaiting-player' | 'active' | 'completed' | 'closed'

export interface UnitState {
  id: 'host-unit' | 'guest-unit'
  integrity: number
}

/**
 * 领域层唯一规则状态。不可变：reducer 必须通过纯更新产生新状态，
 * 不得包含 UI、连接、令牌、旁白或存储句柄。
 */
export interface GameState {
  contentId: 'demo-v1'
  phase: Phase
  round: number
  activeSeat: SeatId | null
  actionPoints: number
  units: [UnitState, UnitState]
  winnerSeat: SeatId | null
}

export type DomainCommand =
  | { type: 'start-demo'; actorSeat: SeatId }
  | { type: 'advance'; actorSeat: SeatId }

export interface DemoStartedEvent {
  type: 'demo-started'
  actorSeat: SeatId
  rngIndex: number
  round: number
  activeSeat: SeatId
}

export interface ActionConfirmedEvent {
  type: 'action-confirmed'
  actorSeat: SeatId
  rngIndex: number
  targetSeat: SeatId
  targetIntegrity: number
}

export interface DemoCompletedEvent {
  type: 'demo-completed'
  actorSeat: SeatId
  rngIndex: number
  winnerSeat: SeatId
}

export type DomainEvent = DemoStartedEvent | ActionConfirmedEvent | DemoCompletedEvent

export type DomainRejectionCode = 'phase_mismatch' | 'not_active_seat' | 'command_invalid'

export interface DomainRejection {
  code: DomainRejectionCode
}
