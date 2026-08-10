import type { Rng } from './rng'
import type { DomainCommand, DomainEvent, DomainRejection, GameState, SeatId } from './types'

export type ReduceResult =
  | { kind: 'accepted'; state: GameState; events: DomainEvent[] }
  | { kind: 'rejected'; rejection: DomainRejection }

function reject(code: DomainRejection['code']): ReduceResult {
  return { kind: 'rejected', rejection: { code } }
}

/**
 * demo-v1 没有随机消费点，rngIndex 恒为 0。
 * 未来随机规则在此处通过 rng.nextRandom() 消费，并把消费索引写入领域事件。
 */
function rngIndexFor(rng: Rng | undefined): number {
  if (rng === undefined) return 0
  return 0
}

function opposite(seat: SeatId): SeatId {
  return seat === 'host' ? 'guest' : 'host'
}

function unitIdForSeat(seat: SeatId): 'host-unit' | 'guest-unit' {
  return seat === 'host' ? 'host-unit' : 'guest-unit'
}

/**
 * 纯命令 reducer：只接收已验证命令，按命令产生下一个状态与领域事件。
 * 不修改输入状态；非法命令返回确定性拒绝且不改变输入状态。
 * 随机数通过注入的确定性 RNG 接口消费（demo-v1 消费次数为 0）。
 */
export function reduceCommand(
  state: GameState,
  command: DomainCommand,
  rng?: Rng,
): ReduceResult {
  switch (command.type) {
    case 'start-demo':
      return reduceStartDemo(state, command.actorSeat, rng)
    case 'advance':
      return reduceAdvance(state, command.actorSeat, rng)
  }
}

function reduceStartDemo(state: GameState, actorSeat: SeatId, rng?: Rng): ReduceResult {
  if (state.phase !== 'awaiting-player') {
    return reject('phase_mismatch')
  }
  if (actorSeat !== 'host') {
    return reject('command_invalid')
  }
  const next: GameState = {
    ...state,
    phase: 'active',
    round: 1,
    activeSeat: 'host',
    actionPoints: 1,
  }
  const event: DomainEvent = {
    type: 'demo-started',
    actorSeat,
    rngIndex: rngIndexFor(rng),
    round: 1,
    activeSeat: 'host',
  }
  return { kind: 'accepted', state: next, events: [event] }
}

function reduceAdvance(state: GameState, actorSeat: SeatId, rng?: Rng): ReduceResult {
  if (state.phase !== 'active') {
    return reject('phase_mismatch')
  }
  if (state.activeSeat !== actorSeat) {
    return reject('not_active_seat')
  }
  const targetSeat = opposite(actorSeat)
  const targetUnit = state.units.find((unit) => unit.id === unitIdForSeat(targetSeat))
  if (!targetUnit || targetUnit.integrity <= 0) {
    return reject('command_invalid')
  }

  const nextIntegrity = targetUnit.integrity - 1
  const updatedUnits = state.units.map((unit) =>
    unit.id === unitIdForSeat(targetSeat) ? { ...unit, integrity: nextIntegrity } : unit,
  ) as GameState['units']

  if (nextIntegrity === 0) {
    const next: GameState = {
      ...state,
      phase: 'completed',
      activeSeat: null,
      actionPoints: 0,
      units: updatedUnits,
      winnerSeat: actorSeat,
    }
    const events: DomainEvent[] = [
      {
        type: 'action-confirmed',
        actorSeat,
        rngIndex: rngIndexFor(rng),
        targetSeat,
        targetIntegrity: 0,
      },
      { type: 'demo-completed', actorSeat, rngIndex: rngIndexFor(rng), winnerSeat: actorSeat },
    ]
    return { kind: 'accepted', state: next, events }
  }

  const nextActiveSeat = targetSeat
  const nextRound = nextActiveSeat === 'host' ? state.round + 1 : state.round
  const next: GameState = {
    ...state,
    round: nextRound,
    activeSeat: nextActiveSeat,
    actionPoints: 1,
    units: updatedUnits,
  }
  const event: DomainEvent = {
    type: 'action-confirmed',
    actorSeat,
    rngIndex: rngIndexFor(rng),
    targetSeat,
    targetIntegrity: nextIntegrity,
  }
  return { kind: 'accepted', state: next, events: [event] }
}
