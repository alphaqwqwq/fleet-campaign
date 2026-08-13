import type { BattlePhase, BattleState } from './types'

const PHASES: readonly BattlePhase[] = ['logistics', 'ballistics', 'action', 'boarding', 'completed']

/** 校验交战领域不变量，返回所有违反项（空数组表示通过）。每次已接受转换后必须保持全部成立。 */
export function checkInvariants(state: BattleState): string[] {
  const violations: string[] = []

  if (!Number.isInteger(state.round) || state.round < 1) {
    violations.push('round must be a positive integer')
  }
  if (!PHASES.includes(state.phase)) {
    violations.push(`phase must be one of ${PHASES.join(', ')}`)
  }

  for (const group of state.battleGroups) {
    if (!Number.isInteger(group.distance) || group.distance < 0 || group.distance > 5) {
      violations.push(`group ${group.id} distance must be an integer 0..5`)
    }
    if (!Number.isInteger(group.blockDice) || group.blockDice < 1) {
      violations.push(`group ${group.id} blockDice must be a positive integer`)
    }
    if (group.status === 'active') {
      if (group.turnActions.maneuvers < 0 || group.turnActions.tactics < 0) {
        violations.push(`group ${group.id} turnActions must be non-negative`)
      }
      if (group.turnActions.maneuvers + group.turnActions.tactics > 2) {
        violations.push(`group ${group.id} turnActions exceed 2 actions`)
      }
    } else if (group.status === 'retreated' || group.status === 'surrendered' || group.status === 'eliminated') {
      if (group.turnActions.maneuvers !== 0 || group.turnActions.tactics !== 0) {
        violations.push(`group ${group.id} must have zero turnActions when not active`)
      }
    }

    for (const ship of [group.flagship, ...group.ships]) {
      if (!Number.isInteger(ship.hp) || ship.hp < 0 || ship.hp > ship.maxHp) {
        violations.push(`ship ${group.id}/${ship.id} hp must be in 0..maxHp`)
      }
      if (ship.status === 'active' && ship.hp <= 0) {
        violations.push(`ship ${group.id}/${ship.id} must not be active at 0 hp`)
      }
      if (ship.status !== 'active' && ship.hp > 0) {
        violations.push(`ship ${group.id}/${ship.id} non-active status must have 0 hp`)
      }
      for (const weapon of ship.weapons) {
        if (weapon.charge !== null && (weapon.charge < 0 || weapon.charge > 99)) {
          violations.push(`weapon ${group.id}/${ship.id}/${weapon.weaponId} charge out of range`)
        }
        if (weapon.flight !== null && weapon.flight < 0) {
          violations.push(`weapon ${group.id}/${ship.id}/${weapon.weaponId} flight must be non-negative`)
        }
        if (weapon.reload !== null && (weapon.reload < 0 || weapon.reload > 99)) {
          violations.push(`weapon ${group.id}/${ship.id}/${weapon.weaponId} reload out of range`)
        }
      }
    }
  }

  if (state.phase === 'action') {
    if (state.activeGroupId !== null) {
      const active = state.battleGroups.find((g) => g.id === state.activeGroupId)
      if (!active || active.status !== 'active') {
        violations.push('activeGroupId must reference an active battle group during action phase')
      }
      if (!state.actionOrder.includes(state.activeGroupId)) {
        violations.push('activeGroupId must be in actionOrder during action phase')
      }
    }
  } else {
    if (state.phase !== 'completed' && state.activeGroupId !== null) {
      violations.push('activeGroupId must be null outside action phase')
    }
  }

  if (state.phase === 'completed') {
    if (state.outcome === null) violations.push('outcome must be set when completed')
  } else if (state.outcome !== null) {
    violations.push('outcome must be null unless completed')
  }

  if (!Number.isInteger(state.rngIndex) || state.rngIndex < 0) {
    violations.push('rngIndex must be a non-negative integer')
  }

  return violations
}
