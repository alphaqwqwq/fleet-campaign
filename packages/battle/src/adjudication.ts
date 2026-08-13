import type { Rng } from './dice'
import { rollD, rollDamage, rollMaxD } from './dice'
import type {
  AttackResolvedEvent,
  BattleEvent,
  BattleGroupState,
  BattleShipState,
  BattleState,
  BattleWeaponState,
  DamageAppliedEvent,
  ShipDestroyedEvent,
  ShipDisabledEvent,
} from './types'

export interface EngineContext {
  rng: Rng
  rngIndex: number
  events: BattleEvent[]
}

export function createEngineContext(rng: Rng, startIndex: number): EngineContext {
  return { rng, rngIndex: startIndex, events: [] }
}

/** 把一批已带准确 rngIndex 的事件并入 ctx，并按消费数推进索引。 */
export function commitEvents(ctx: EngineContext, events: BattleEvent[], consumed: number): void {
  for (const event of events) ctx.events.push(event)
  ctx.rngIndex += consumed
}

export interface BandModifiers {
  accuracyDice: number
  difficultyDice: number
  payloadFlight: number
  areaBonus: number
}

/** 该群当前距离带对攻击的修正（原作 P45-47）。 */
export function bandModifiers(distance: number, isCharge: boolean): BandModifiers {
  if (distance === 5 || distance === 4) {
    return {
      accuracyDice: isCharge ? 1 : 0,
      difficultyDice: isCharge ? 0 : 1,
      payloadFlight: distance,
      areaBonus: 0,
    }
  }
  if (distance === 3) return { accuracyDice: 0, difficultyDice: 0, payloadFlight: 3, areaBonus: 0 }
  if (distance === 2) return { accuracyDice: 0, difficultyDice: 0, payloadFlight: 2, areaBonus: 0 }
  if (distance === 1) return { accuracyDice: isCharge ? 0 : 1, difficultyDice: 0, payloadFlight: 1, areaBonus: 2 }
  return { accuracyDice: isCharge ? 0 : 1, difficultyDice: 0, payloadFlight: 0, areaBonus: 4 }
}

/** 该船是否处于谨慎射击（攻击不可会心、不可降至 0 以下）。 */
export function hasCarefulFire(group: BattleGroupState): boolean {
  return group.statusEffects.some((effect) => effect.kind === 'careful-fire')
}

/** 目标舰是否被锁定（+1 准度，攻击结算后消耗）。 */
export function isLocked(group: BattleGroupState, shipId: string): boolean {
  return group.statusEffects.some((effect) => effect.kind === 'locked' && effect.target === shipId)
}

export interface AttackOutcome {
  events: BattleEvent[]
  consumed: number
}

/**
 * 单目标攻击裁决。固定消费序：命中 d20 → 准度 d6 → 难度 d6 → 伤害骰。
 * 伤害骰**无论命中与否都掷**，保证每个攻击的消费次数与结果无关（确定性契约）。
 */
export function resolveSingleTargetAttack(
  ctx: EngineContext,
  attacker: BattleGroupState,
  weapon: BattleWeaponState,
  targetGroup: BattleGroupState,
  targetShip: BattleShipState,
): AttackOutcome {
  const rand = () => ctx.rng.nextRandom()
  const isCharge = weapon.charge !== null

  const attackIndex = ctx.rngIndex
  const attackRoll = rollD(rand, 20)
  const band = bandModifiers(attacker.distance, isCharge)
  let accuracyDice = band.accuracyDice
  const difficultyDice = band.difficultyDice
  if (isLocked(targetGroup, targetShip.id)) accuracyDice += 1
  const accuracy = rollMaxD(rand, accuracyDice, 6)
  const difficulty = rollMaxD(rand, difficultyDice, 6)
  const total = attackRoll + accuracy - difficulty
  const hit = total >= targetShip.defense
  const careful = hasCarefulFire(attacker)
  const crit = weapon.crit && total >= 20 && !careful

  const attackEvent: AttackResolvedEvent = {
    type: 'attack-resolved',
    rngIndex: attackIndex,
    attackerGroupId: attacker.id,
    weaponId: weapon.weaponId,
    targetShipId: targetShip.id,
    roll: attackRoll,
    accuracyBonus: accuracy,
    difficultyPenalty: difficulty,
    total,
    defense: targetShip.defense,
    hit,
    crit,
  }

  const damageIndex = attackIndex + 1 + accuracyDice + difficultyDice
  const damage = rollDamage(rand, weapon.damage)
  const gross = crit ? damage.value * 2 : damage.value

  const events: BattleEvent[] = [attackEvent]
  if (hit) {
    events.push(buildDamageEvent(damageIndex, targetGroup, targetShip, gross, 0, careful))
  }
  const consumed = 1 + accuracyDice + difficultyDice + damage.consumed
  return { events, consumed }
}

/** 区域伤害裁决：伤害骰固定掷（按群一次），随后可选阻滞骰（对目标群）。 */
export function resolveAreaAttack(
  ctx: EngineContext,
  attacker: BattleGroupState,
  weapon: BattleWeaponState,
  targetGroup: BattleGroupState,
  areaBonus: number,
  allowBlock: boolean,
): AttackOutcome {
  const rand = () => ctx.rng.nextRandom()
  const damageIndex = ctx.rngIndex
  const damage = rollDamage(rand, weapon.damage)
  const gross = damage.value + areaBonus

  let blockIndex: number | undefined
  let blockRoll: number | undefined
  if (allowBlock && targetGroup.blockDice > 0) {
    blockIndex = damageIndex + damage.consumed
    blockRoll = rollMaxD(rand, targetGroup.blockDice, 6)
  }
  const net = Math.max(0, gross - (blockRoll ?? 0))

  const careful = hasCarefulFire(attacker)
  const ships = [targetGroup.flagship, ...targetGroup.ships].filter((ship) => ship.status === 'active')
  const damageEvents = ships.map((ship) => buildDamageEvent(damageIndex, targetGroup, ship, net, blockRoll ?? 0, careful))

  const events: BattleEvent[] = [
    {
      type: 'attack-resolved',
      rngIndex: damageIndex,
      attackerGroupId: attacker.id,
      weaponId: weapon.weaponId,
      targetShipId: targetGroup.flagship.id,
      roll: 0,
      accuracyBonus: 0,
      difficultyPenalty: 0,
      total: 0,
      defense: 0,
      hit: true,
      crit: false,
    },
    ...damageEvents,
  ]
  if (blockIndex !== undefined && blockRoll !== undefined) {
    events.push({
      type: 'block-rolled',
      rngIndex: blockIndex,
      battleGroupId: targetGroup.id,
      blockDice: targetGroup.blockDice,
      roll: blockRoll,
    })
  }
  const consumed = damage.consumed + (blockIndex !== undefined ? targetGroup.blockDice : 0)
  return { events, consumed }
}

function buildDamageEvent(
  rngIndex: number,
  targetGroup: BattleGroupState,
  targetShip: BattleShipState,
  gross: number,
  blocked: number,
  careful: boolean,
): DamageAppliedEvent {
  const net = Math.max(0, gross - blocked)
  const wouldDestroy = targetShip.hp - net <= 0
  let finalNet = net
  let disabled: boolean | undefined
  let destroyed: boolean | undefined
  if (wouldDestroy && careful) {
    finalNet = Math.max(0, targetShip.hp - 1)
    disabled = true
  } else if (wouldDestroy) {
    destroyed = true
  }
  return {
    type: 'damage-applied',
    rngIndex,
    targetGroupId: targetGroup.id,
    targetShipId: targetShip.id,
    gross,
    blocked,
    net: finalNet,
    destroyed,
    disabled,
  }
}

/** 把伤害事件应用到领域状态（纯更新）。 */
export function applyDamageToState(state: BattleState, damage: DamageAppliedEvent[]): BattleState {
  let next = state
  for (const event of damage) {
    if (event.net === 0) continue
    next = {
      ...next,
      battleGroups: next.battleGroups.map((group) => {
        if (group.id !== event.targetGroupId) return group
        const updateShip = (ship: BattleShipState): BattleShipState => {
          if (ship.id !== event.targetShipId) return ship
          const hp = Math.max(0, ship.hp - event.net)
          const status = event.destroyed ? 'destroyed' : event.disabled ? 'disabled' : hp <= 0 ? 'destroyed' : 'active'
          return { ...ship, hp, status }
        }
        return {
          ...group,
          flagship: group.flagship.id === event.targetShipId ? updateShip(group.flagship) : group.flagship,
          ships: group.ships.map(updateShip),
        }
      }),
    }
  }
  return next
}

/** 从伤害事件派生 ship-destroyed / ship-disabled 事件。 */
export function shipStateEvents(damage: DamageAppliedEvent[]): (ShipDestroyedEvent | ShipDisabledEvent)[] {
  const events: (ShipDestroyedEvent | ShipDisabledEvent)[] = []
  for (const event of damage) {
    if (event.destroyed) {
      events.push({ type: 'ship-destroyed', rngIndex: event.rngIndex, battleGroupId: event.targetGroupId, shipId: event.targetShipId })
    } else if (event.disabled) {
      events.push({ type: 'ship-disabled', rngIndex: event.rngIndex, battleGroupId: event.targetGroupId, shipId: event.targetShipId })
    }
  }
  return events
}
