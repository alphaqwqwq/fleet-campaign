import type { GameState } from './types'

/**
 * 校验领域不变量，返回所有违反项（空数组表示通过）。
 * 每次已接受状态转换后都必须保持全部不变量。
 */
export function checkInvariants(state: GameState): string[] {
  const violations: string[] = []

  if (state.phase !== 'active') {
    if (state.activeSeat !== null) violations.push('activeSeat must be null outside active phase')
    if (state.actionPoints !== 0) violations.push('actionPoints must be 0 outside active phase')
  } else {
    if (state.activeSeat === null) violations.push('activeSeat must be set in active phase')
    if (state.actionPoints !== 1) violations.push('actionPoints must be 1 in active phase')
  }

  for (const unit of state.units) {
    if (!Number.isInteger(unit.integrity) || unit.integrity < 0 || unit.integrity > 3) {
      violations.push(`unit ${unit.id} integrity must be an integer in 0..3`)
    }
  }

  if (state.phase === 'completed') {
    if (state.winnerSeat === null) {
      violations.push('winnerSeat must be set when completed')
    } else {
      const opponent = state.winnerSeat === 'host' ? 'guest-unit' : 'host-unit'
      const opponentUnit = state.units.find((unit) => unit.id === opponent)
      if (opponentUnit && opponentUnit.integrity !== 0) {
        violations.push('winner opponent integrity must be 0')
      }
    }
  } else if (state.winnerSeat !== null) {
    violations.push('winnerSeat must be null unless completed')
  }

  return violations
}
