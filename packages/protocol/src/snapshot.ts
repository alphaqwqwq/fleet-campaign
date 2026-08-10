import type { GameState, SeatId } from '@fleet-campaign/domain'

import type { ProtocolVersion } from './version'

export const VISIBILITIES = ['host', 'player', 'spectator'] as const

export type Visibility = (typeof VISIBILITIES)[number]

export const ROSTER_ROLES = ['host', 'player', 'spectator'] as const

export type RosterRole = (typeof ROSTER_ROLES)[number]

export interface GameView {
  contentId: string
  phase: GameState['phase']
  round: number
  activeSeat: SeatId | null
  actionPoints: number
  units: { id: string; integrity: number }[]
  winnerSeat: SeatId | null
}

/** 只含 clientId、席位与角色，绝不含令牌。 */
export interface RosterEntry {
  clientId: string
  seat: SeatId
  role: RosterRole
}

export interface Snapshot {
  protocolVersion: ProtocolVersion
  roomId: string
  campaignId: string
  eventSequence: number
  game: GameView
  roster: RosterEntry[]
  visibility: Visibility
}

/** 从领域公开状态投影所有参与者可见的完整抽象状态。 */
export function projectGame(state: GameState): GameView {
  return {
    contentId: state.contentId,
    phase: state.phase,
    round: state.round,
    activeSeat: state.activeSeat,
    actionPoints: state.actionPoints,
    units: state.units.map((unit) => ({ id: unit.id, integrity: unit.integrity })),
    winnerSeat: state.winnerSeat,
  }
}
