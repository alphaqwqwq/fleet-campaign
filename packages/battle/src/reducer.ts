import { validateBattleContent, type BattleContent } from '@fleet-campaign/content'

import type { EngineContext } from './adjudication'
import {
  applyDamageToState,
  bandModifiers,
  commitEvents,
  createEngineContext,
  resolveAreaAttack,
  resolveSingleTargetAttack,
  shipStateEvents,
} from './adjudication'
import { createInitialBattle } from './create'
import type { Rng } from './dice'
import type {
  BattleCommand,
  BattleEvent,
  BattleGroupState,
  BattleRejection,
  BattleRejectionCode,
  BattleShipState,
  BattleState,
  BattleWeaponState,
  StatusEffect,
} from './types'

export type ReduceResult =
  | { kind: 'accepted'; state: BattleState; events: BattleEvent[] }
  | { kind: 'rejected'; rejection: BattleRejection }

function reject(code: BattleRejectionCode): ReduceResult {
  return { kind: 'rejected', rejection: { code } }
}

function groupById(state: BattleState, id: string): BattleGroupState | undefined {
  return state.battleGroups.find((group) => group.id === id)
}

function allShips(group: BattleGroupState): BattleShipState[] {
  return [group.flagship, ...group.ships]
}

function activeShips(group: BattleGroupState): BattleShipState[] {
  return allShips(group).filter((ship) => ship.status === 'active')
}

function updateGroup(state: BattleState, groupId: string, update: (group: BattleGroupState) => BattleGroupState): BattleState {
  return {
    ...state,
    battleGroups: state.battleGroups.map((group) => (group.id === groupId ? update(group) : group)),
  }
}

/**
 * 建立交战的创建 API（等价于 schema 的 start-engagement）：
 * 内容必须通过校验，返回 engagement-started 事件。
 */
export function startEngagement(content: BattleContent, engagementId?: string): ReduceResult {
  const validation = validateBattleContent(content)
  if (!validation.ok) {
    return { kind: 'rejected', rejection: { code: 'content_invalid' } }
  }
  const created = createInitialBattle(content, engagementId)
  if (!created.ok) {
    return { kind: 'rejected', rejection: { code: 'content_invalid' } }
  }
  const state = created.state
  const event: BattleEvent = {
    type: 'engagement-started',
    rngIndex: 0,
    engagementId: state.engagementId,
    contentId: state.contentId,
    round: 1,
    battleGroups: state.battleGroups.map((group) => ({
      id: group.id,
      faction: group.faction,
      distance: group.distance,
      ships: allShips(group).map((ship) => ship.id),
    })),
  }
  return { kind: 'accepted', state, events: [event] }
}

export function reduceCommand(state: BattleState, command: BattleCommand, rng?: Rng): ReduceResult {
  switch (command.type) {
    case 'advance-phase':
      return reduceAdvancePhase(state, command.actorId, rng)
    case 'declare-retreat':
      return reduceDeclareRetreat(state, command.actorId, command.battleGroupId)
    case 'declare-surrender':
      return reduceDeclareSurrender(state, command.actorId, command.battleGroupId)
    case 'maneuver':
      return reduceManeuver(state, command, rng)
    case 'tactic':
      return reduceTactic(state, command)
    case 'fire-charged':
      return reduceFireCharged(state, command.actorId, command.battleGroupId, command.weaponId, command.target, rng)
    case 'delay-charged':
      return reduceDelayCharged(state, command.actorId, command.battleGroupId, command.weaponId)
    case 'end-turn':
      return reduceEndTurn(state, command.actorId, command.battleGroupId)
    case 'resolve-engagement':
      return reduceResolveEngagement(state, command.actorId)
  }
}

function reduceAdvancePhase(state: BattleState, _actorId: string, rng?: Rng): ReduceResult {
  if (!rng) return reject('command_invalid')
  const ctx = createEngineContext(rng, state.rngIndex)

  switch (state.phase) {
    case 'logistics':
      return advanceLogistics(state, ctx)
    case 'ballistics':
      return advanceBallistics(state, ctx)
    case 'action':
      if (state.activeGroupId !== null) return reject('not_all_turns_ended')
      return advanceToBoarding(state, ctx)
    case 'boarding':
      return advanceToNextRound(state, ctx)
    default:
      return reject('phase_mismatch')
  }
}

/** 后勤 → 弹着：计数器 -1。 */
function advanceLogistics(state: BattleState, ctx: EngineContext): ReduceResult {
  const { next, tickEvents } = tickCounters(state)
  for (const event of tickEvents) ctx.events.push({ ...event, rngIndex: ctx.rngIndex })
  const ballisticsState: BattleState = { ...next, phase: 'ballistics' }
  ctx.events.push({ type: 'phase-advanced', rngIndex: ctx.rngIndex, from: 'logistics', to: 'ballistics' })
  return finish(ctx, ballisticsState)
}

/** 弹着 → 行动：结算酬载命中（每群阻滞骰一次），清除锁定，进入行动阶段。 */
function advanceBallistics(state: BattleState, ctx: EngineContext): ReduceResult {
  let next = resolvePayloadHits(state, ctx)
  next = markEliminatedGroups(next)
  // 清除锁定（下个弹着阶段开始时到期）。
  next = clearStatusEffects(next, 'locked')
  const order = buildActionOrder(next)
  const actionState: BattleState = {
    ...next,
    phase: 'action',
    actionOrder: order,
    activeGroupId: order[0] ?? null,
    battleGroups: next.battleGroups.map((group) => ({ ...group, turnActions: { maneuvers: 0, tactics: 0 } })),
  }
  ctx.events.push({ type: 'phase-advanced', rngIndex: ctx.rngIndex, from: 'ballistics', to: 'action' })
  return finish(ctx, actionState)
}

/** 行动 → 接舷（v1 空转）。 */
function advanceToBoarding(state: BattleState, ctx: EngineContext): ReduceResult {
  const boardingState: BattleState = { ...state, phase: 'boarding' }
  ctx.events.push({ type: 'phase-advanced', rngIndex: ctx.rngIndex, from: 'action', to: 'boarding' })
  return finish(ctx, boardingState)
}

/** 接舷 → 下一轮后勤（含临界点坍缩、效果到期）。 */
function advanceToNextRound(state: BattleState, ctx: EngineContext): ReduceResult {
  const round = state.round + 1
  let next: BattleState = { ...state, round, phase: 'logistics' }
  next = applyCollapse(next, round)
  next = expireRoundEffects(next, round)
  ctx.events.push({ type: 'round-started', rngIndex: ctx.rngIndex, round, phase: 'logistics' })
  ctx.events.push({ type: 'phase-advanced', rngIndex: ctx.rngIndex, from: 'boarding', to: 'logistics' })
  return finish(ctx, next)
}

function buildActionOrder(state: BattleState): string[] {
  const active = state.battleGroups.filter((group) => group.status === 'active')
  const players = active.filter((group) => group.faction === 'player')
  const enemies = active.filter((group) => group.faction === 'enemy')
  const order: string[] = []
  const max = Math.max(players.length, enemies.length)
  for (let i = 0; i < max; i++) {
    if (i < players.length) order.push(players[i].id)
    if (i < enemies.length) order.push(enemies[i].id)
  }
  return order
}

/** 后勤计数器 tick：charge/flight/reload 均 -1（到 0 为止）。 */
function tickCounters(state: BattleState): { next: BattleState; tickEvents: BattleEvent[] } {
  const tickEvents: BattleEvent[] = []
  const next: BattleState = {
    ...state,
    battleGroups: state.battleGroups.map((group) => {
      const tickShip = (ship: BattleShipState): BattleShipState => ({
        ...ship,
        weapons: ship.weapons.map((weapon) => {
          const charge = weapon.charge === null ? null : Math.max(0, weapon.charge - 1)
          const flight = weapon.flight === null ? null : Math.max(0, weapon.flight - 1)
          const reload = weapon.reload === null ? null : Math.max(0, weapon.reload - 1)
          if (charge !== weapon.charge || flight !== weapon.flight || reload !== weapon.reload) {
            tickEvents.push({
              type: 'counter-tick',
              rngIndex: 0,
              battleGroupId: group.id,
              weaponId: weapon.weaponId,
              charge,
              flight,
              reload,
            })
          }
          return { ...weapon, charge, flight, reload }
        }),
      })
      return { ...group, flagship: tickShip(group.flagship), ships: group.ships.map(tickShip) }
    }),
  }
  return { next, tickEvents }
}

/** 弹着：对飞行计数为 0 的酬载武器结算（区域伤害 + 每群一次阻滞）。 */
function resolvePayloadHits(state: BattleState, ctx: EngineContext): BattleState {
  let next = state
  const hits = state.battleGroups.flatMap((group) =>
    allShips(group).flatMap((ship) =>
      ship.weapons.filter((weapon) => weapon.flight === 0).map((weapon) => ({ group, weapon })),
    ),
  )
  for (const { group, weapon } of hits) {
    const targetGroup = state.battleGroups.find((g) => g.id !== group.id)
    if (!targetGroup || targetGroup.status !== 'active') continue
    const band = bandModifiers(group.distance, false)
    const outcome = resolveAreaAttack(ctx, group, weapon, targetGroup, band.areaBonus, true)
    commitEvents(ctx, outcome.events, outcome.consumed)
    const damageEvents = outcome.events.filter((e): e is Extract<BattleEvent, { type: 'damage-applied' }> => e.type === 'damage-applied')
    next = applyDamageToState(next, damageEvents)
    next = emitShipState(next, ctx, damageEvents)
    // 命中后飞行计数归空。
    next = resetFlight(next, group.id, weapon.weaponId)
  }
  return next
}

function resetFlight(state: BattleState, groupId: string, weaponId: string): BattleState {
  return updateGroup(state, groupId, (group) => {
    const setWeapon = (ship: BattleShipState): BattleShipState => ({
      ...ship,
      weapons: ship.weapons.map((w) => (w.weaponId === weaponId ? { ...w, flight: null } : w)),
    })
    return {
      ...group,
      flagship: group.flagship.weapons.some((w) => w.weaponId === weaponId) ? setWeapon(group.flagship) : group.flagship,
      ships: group.ships.map(setWeapon),
    }
  })
}

/** 将伤害事件派生为 ship-destroyed / ship-disabled 事件并入 ctx。 */
function emitShipState(state: BattleState, ctx: EngineContext, damage: Extract<BattleEvent, { type: 'damage-applied' }>[]): BattleState {
  for (const event of shipStateEvents(damage)) {
    ctx.events.push(event)
  }
  return state
}

function clearStatusEffects(state: BattleState, kind: StatusEffect['kind']): BattleState {
  return {
    ...state,
    battleGroups: state.battleGroups.map((group) => ({
      ...group,
      statusEffects: group.statusEffects.filter((effect) => effect.kind !== kind),
    })),
  }
}

function expireRoundEffects(state: BattleState, round: number): BattleState {
  return {
    ...state,
    battleGroups: state.battleGroups.map((group) => ({
      ...group,
      statusEffects: group.statusEffects.filter((effect) => {
        if (effect.kind !== 'braced' && effect.kind !== 'careful-fire') return true
        if (effect.expiresRound === undefined) return true
        return effect.expiresRound >= round
      }),
    })),
  }
}

function reduceDeclareRetreat(state: BattleState, actorId: string, battleGroupId: string): ReduceResult {
  const group = groupById(state, battleGroupId)
  if (!group || group.controller !== actorId) return reject('forbidden_controller')
  if (state.phase !== 'logistics') return reject('phase_mismatch')
  if (state.round < 5) return reject('critical_not_reached')
  if (group.distance === 0 && state.round > 6) return reject('cannot_retreat')
  if (group.status !== 'active') return reject('command_invalid')
  // 整群撤退：酬载攻击全部自毁、伴随单位移除、状态清空。
  const next = updateGroup(state, group.id, (g) => {
    const clearWeapon = (ship: BattleShipState): BattleShipState => ({
      ...ship,
      weapons: ship.weapons.map((w) => (w.flight !== null ? { ...w, flight: null } : w)),
    })
    return {
      ...g,
      flagship: clearWeapon(g.flagship),
      ships: g.ships.map(clearWeapon),
      status: 'retreated' as const,
      statusEffects: [],
    }
  })
  return accepted(next, { type: 'retreat-declared', rngIndex: state.rngIndex, battleGroupId })
}

function reduceDeclareSurrender(state: BattleState, actorId: string, battleGroupId: string): ReduceResult {
  const group = groupById(state, battleGroupId)
  if (!group || group.controller !== actorId) return reject('forbidden_controller')
  if (state.phase !== 'logistics') return reject('phase_mismatch')
  if (group.status !== 'active') return reject('command_invalid')
  const next = updateGroup(state, group.id, (g) => ({ ...g, status: 'surrendered' as const, statusEffects: [] }))
  return accepted(next, { type: 'surrender-declared', rngIndex: state.rngIndex, battleGroupId })
}

interface ValidatedAttack {
  weapon: BattleWeaponState
  targetGroup: BattleGroupState
  targetShip: BattleShipState
}

/**
 * 机动攻击预校验（不消费 RNG）：返回每个攻击的引用或第一个拒绝码。
 * 任一攻击非法 → 整条机动拒绝，且不消费任何随机数。
 */
function validateManeuverAttacks(
  state: BattleState,
  group: BattleGroupState,
  maneuver: 'full-thrust' | 'all-guns-fire' | 'retro-thrust',
  attacks: NonNullable<Extract<BattleCommand, { type: 'maneuver' }>['attacks']>,
): { ok: true; validated: ValidatedAttack[] } | { ok: false; code: BattleRejectionCode } {
  if (maneuver === 'retro-thrust' && attacks.length > 0) return { ok: false, code: 'command_invalid' }
  if (maneuver === 'full-thrust' && attacks.length > 1) return { ok: false, code: 'command_invalid' }
  if (maneuver === 'all-guns-fire' && attacks.length > 2) return { ok: false, code: 'command_invalid' }
  if (maneuver === 'all-guns-fire' && attacks.length === 2 && attacks[0].weaponId === attacks[1].weaponId) {
    return { ok: false, code: 'command_invalid' }
  }

  const validated: ValidatedAttack[] = []
  for (const attack of attacks) {
    const ship = allShips(group).find((s) => s.weapons.some((w) => w.weaponId === attack.weaponId))
    const weapon = ship?.weapons.find((w) => w.weaponId === attack.weaponId)
    if (!weapon) return { ok: false, code: 'no_valid_target' }
    // 充能武器只能在弹着阶段以 fire-charged 发射。
    if (weapon.charge !== null) return { ok: false, code: 'no_valid_target' }
    if (maneuver === 'full-thrust' && weapon.size !== 'main') return { ok: false, code: 'command_invalid' }
    // 全舰开火：1 超重型，或至多 2 不同武器（单 main 不合规）。
    if (maneuver === 'all-guns-fire' && attacks.length === 1 && weapon.size !== 'superheavy') {
      return { ok: false, code: 'command_invalid' }
    }
    const targetGroup = groupById(state, attack.target.groupId)
    if (!targetGroup || targetGroup.faction === group.faction || targetGroup.status !== 'active') {
      return { ok: false, code: 'no_valid_target' }
    }
    const targetShip = allShips(targetGroup).find((s) => s.id === attack.target.shipId)
    if (!targetShip || targetShip.status !== 'active') return { ok: false, code: 'no_valid_target' }
    if (group.distance > weapon.range) return { ok: false, code: 'no_valid_target' }
    validated.push({ weapon, targetGroup, targetShip })
  }
  return { ok: true, validated }
}

function reduceManeuver(
  state: BattleState,
  command: Extract<BattleCommand, { type: 'maneuver' }>,
  rng?: Rng,
): ReduceResult {
  if (!rng) return reject('command_invalid')
  const group = groupById(state, command.battleGroupId)
  if (!group || group.controller !== command.actorId) return reject('forbidden_controller')
  if (state.phase !== 'action') return reject('phase_mismatch')
  if (state.activeGroupId !== group.id) return reject('not_active_group')
  if (group.turnActions.maneuvers >= 1) return reject('command_invalid')
  if (group.turnActions.maneuvers + group.turnActions.tactics >= 2) return reject('command_invalid')

  const attacks = command.attacks ?? []
  const validated = validateManeuverAttacks(state, group, command.maneuver, attacks)
  if (!validated.ok) return reject(validated.code)

  const ctx = createEngineContext(rng, state.rngIndex)
  const distanceBefore = group.distance

  let distanceAfter = distanceBefore
  if (command.maneuver === 'full-thrust') {
    distanceAfter = Math.max(0, distanceBefore - 1)
  } else if (command.maneuver === 'retro-thrust') {
    distanceAfter = command.retreat === true ? Math.min(5, distanceBefore + 1) : distanceBefore
  }

  let next = updateGroup(state, group.id, (g) => ({
    ...g,
    distance: distanceAfter,
    turnActions: { maneuvers: g.turnActions.maneuvers + 1, tactics: g.turnActions.tactics },
  }))

  if (command.maneuver === 'retro-thrust') {
    next = applyStatusEffect(next, ctx, group.id, { kind: 'braced', expiresRound: state.round + 1 })
  }

  ctx.events.push({
    type: 'maneuver-performed',
    rngIndex: ctx.rngIndex,
    battleGroupId: group.id,
    maneuver: command.maneuver,
    distanceBefore,
    distanceAfter,
  })

  for (const target of validated.validated) {
    const attacker = groupById(next, group.id)!
    const fired = fireWeapon(ctx, next, attacker, target.weapon, target.targetGroup, target.targetShip)
    next = fired.state
  }
  next = markEliminatedGroups(next)
  return finish(ctx, next)
}

function reduceTactic(state: BattleState, command: Extract<BattleCommand, { type: 'tactic' }>): ReduceResult {
  const group = groupById(state, command.battleGroupId)
  if (!group || group.controller !== command.actorId) return reject('forbidden_controller')
  if (state.phase !== 'action') return reject('phase_mismatch')
  if (state.activeGroupId !== group.id) return reject('not_active_group')
  if (group.turnActions.maneuvers + group.turnActions.tactics >= 2) return reject('command_invalid')

  const ctx = createEngineContext(noopRng(), state.rngIndex)

  let next = state
  if (command.tactic === 'emergency-maneuver') {
    if (group.limitedUsed.includes('emergency-maneuver')) return reject('limit_reached')
    if (command.direction !== 'advance' && command.direction !== 'retreat') return reject('command_invalid')
    const distanceAfter =
      command.direction === 'advance' ? Math.max(0, group.distance - 1) : Math.min(5, group.distance + 1)
    next = updateGroup(state, group.id, (g) => ({
      ...g,
      distance: distanceAfter,
      limitedUsed: [...g.limitedUsed, 'emergency-maneuver'],
    }))
  } else if (command.tactic === 'lock-on') {
    if (!command.target) return reject('no_valid_target')
    const targetGroup = groupById(state, command.target.groupId)
    if (!targetGroup || targetGroup.faction === group.faction) return reject('no_valid_target')
    const ship = allShips(targetGroup).find((s) => s.id === command.target!.shipId)
    if (!ship || ship.status !== 'active') return reject('no_valid_target')
    next = applyStatusEffect(state, ctx, targetGroup.id, { kind: 'locked', target: command.target.shipId })
  } else if (command.tactic === 'careful-fire') {
    next = applyStatusEffect(state, ctx, group.id, { kind: 'careful-fire', expiresRound: state.round + 1 })
  }

  next = updateGroup(next, group.id, (g) => ({
    ...g,
    turnActions: { maneuvers: g.turnActions.maneuvers, tactics: g.turnActions.tactics + 1 },
  }))

  ctx.events.push({
    type: 'tactic-performed',
    rngIndex: ctx.rngIndex,
    battleGroupId: group.id,
    tactic: command.tactic,
    target: command.target,
  })
  return finish(ctx, next)
}

function applyStatusEffect(state: BattleState, ctx: EngineContext, groupId: string, effect: StatusEffect): BattleState {
  const next = updateGroup(state, groupId, (group) => {
    const filtered = group.statusEffects.filter((e) => !(e.kind === effect.kind && e.target === effect.target))
    return { ...group, statusEffects: [...filtered, effect] }
  })
  ctx.events.push({
    type: 'status-applied',
    rngIndex: ctx.rngIndex,
    battleGroupId: groupId,
    status: effect.kind,
    target: effect.target,
  })
  return next
}

interface FireResult {
  state: BattleState
}

/** 发射已预校验的武器（单目标 vs 区域 vs 酬载发射）。 */
function fireWeapon(
  ctx: EngineContext,
  state: BattleState,
  attacker: BattleGroupState,
  weapon: BattleWeaponState,
  targetGroup: BattleGroupState,
  targetShip: BattleShipState,
): FireResult {
  // 酬载：设置飞行计数（按发射距离带），在弹着阶段命中。
  if (weapon.payload) {
    const flight = bandModifiers(attacker.distance, false).payloadFlight
    const next = updateGroup(state, attacker.id, (group) => {
      const setWeapon = (ship: BattleShipState): BattleShipState => ({
        ...ship,
        weapons: ship.weapons.map((w) => (w.weaponId === weapon.weaponId ? { ...w, flight } : w)),
      })
      return {
        ...group,
        flagship: group.flagship.weapons.some((w) => w.weaponId === weapon.weaponId)
          ? setWeapon(group.flagship)
          : group.flagship,
        ships: group.ships.map(setWeapon),
      }
    })
    return { state: next }
  }

  // 区域武器：无需命中骰，直接结算区域伤害（可被阻滞）。
  if (weapon.area) {
    const band = bandModifiers(attacker.distance, false)
    const outcome = resolveAreaAttack(ctx, attacker, weapon, targetGroup, band.areaBonus, true)
    commitEvents(ctx, outcome.events, outcome.consumed)
    const damageEvents = outcome.events.filter((e): e is Extract<BattleEvent, { type: 'damage-applied' }> => e.type === 'damage-applied')
    const next = applyDamageToState(state, damageEvents)
    emitShipState(next, ctx, damageEvents)
    return { state: next }
  }

  // 单目标攻击。
  const outcome = resolveSingleTargetAttack(ctx, attacker, weapon, targetGroup, targetShip)
  commitEvents(ctx, outcome.events, outcome.consumed)
  const damageEvents = outcome.events.filter((e): e is Extract<BattleEvent, { type: 'damage-applied' }> => e.type === 'damage-applied')
  const next = applyDamageToState(state, damageEvents)
  emitShipState(next, ctx, damageEvents)
  return { state: next }
}

function reduceFireCharged(
  state: BattleState,
  actorId: string,
  battleGroupId: string,
  weaponId: string,
  target: { groupId: string; shipId: string },
  rng?: Rng,
): ReduceResult {
  if (!rng) return reject('command_invalid')
  const group = groupById(state, battleGroupId)
  if (!group || group.controller !== actorId) return reject('forbidden_controller')
  if (state.phase !== 'ballistics') return reject('phase_mismatch')
  const ctx = createEngineContext(rng, state.rngIndex)
  const ship = allShips(group).find((s) => s.weapons.some((w) => w.weaponId === weaponId))
  const weapon = ship?.weapons.find((w) => w.weaponId === weaponId)
  if (!weapon || weapon.charge === null || weapon.charge !== 0) return reject('command_invalid')
  const targetGroup = groupById(state, target.groupId)
  if (!targetGroup || targetGroup.faction === group.faction || targetGroup.status !== 'active') {
    return reject('no_valid_target')
  }
  const targetShip = allShips(targetGroup).find((s) => s.id === target.shipId)
  if (!targetShip || targetShip.status !== 'active') return reject('no_valid_target')
  if (group.distance > weapon.range) return reject('no_valid_target')

  ctx.events.push({ type: 'charged-fired', rngIndex: ctx.rngIndex, battleGroupId, weaponId, target })
  const fired = weapon.area
    ? fireAreaCharged(ctx, state, group, weapon, targetGroup)
    : fireSingleCharged(ctx, state, group, weapon, targetGroup, targetShip)

  // 开火后重设充能计数为 chargeMax（原作：发射并重设自身计数）。
  const reset = updateGroup(fired.state, group.id, (g) => {
    const setWeapon = (ship: BattleShipState): BattleShipState => ({
      ...ship,
      weapons: ship.weapons.map((w) => (w.weaponId === weaponId && w.chargeMax !== null ? { ...w, charge: w.chargeMax } : w)),
    })
    return {
      ...g,
      flagship: g.flagship.weapons.some((w) => w.weaponId === weaponId) ? setWeapon(g.flagship) : g.flagship,
      ships: g.ships.map(setWeapon),
    }
  })
  return finish(ctx, markEliminatedGroups(reset))
}

function fireSingleCharged(
  ctx: EngineContext,
  state: BattleState,
  attacker: BattleGroupState,
  weapon: BattleWeaponState,
  targetGroup: BattleGroupState,
  targetShip: BattleShipState,
): FireResult {
  const outcome = resolveSingleTargetAttack(ctx, attacker, weapon, targetGroup, targetShip)
  commitEvents(ctx, outcome.events, outcome.consumed)
  const damageEvents = outcome.events.filter((e): e is Extract<BattleEvent, { type: 'damage-applied' }> => e.type === 'damage-applied')
  const next = applyDamageToState(state, damageEvents)
  emitShipState(next, ctx, damageEvents)
  return { state: next }
}

function fireAreaCharged(
  ctx: EngineContext,
  state: BattleState,
  attacker: BattleGroupState,
  weapon: BattleWeaponState,
  targetGroup: BattleGroupState,
): FireResult {
  const band = bandModifiers(attacker.distance, true)
  const outcome = resolveAreaAttack(ctx, attacker, weapon, targetGroup, band.areaBonus, true)
  commitEvents(ctx, outcome.events, outcome.consumed)
  const damageEvents = outcome.events.filter((e): e is Extract<BattleEvent, { type: 'damage-applied' }> => e.type === 'damage-applied')
  const next = applyDamageToState(state, damageEvents)
  emitShipState(next, ctx, damageEvents)
  return { state: next }
}

function reduceDelayCharged(state: BattleState, actorId: string, battleGroupId: string, weaponId: string): ReduceResult {
  const group = groupById(state, battleGroupId)
  if (!group || group.controller !== actorId) return reject('forbidden_controller')
  if (state.phase !== 'ballistics') return reject('phase_mismatch')
  const weapon = allShips(group).flatMap((ship) => ship.weapons).find((w) => w.weaponId === weaponId)
  if (!weapon || weapon.charge === null || weapon.charge !== 0) return reject('command_invalid')
  return accepted(state, { type: 'charged-delayed', rngIndex: state.rngIndex, battleGroupId, weaponId })
}

function reduceEndTurn(state: BattleState, actorId: string, battleGroupId: string): ReduceResult {
  const group = groupById(state, battleGroupId)
  if (!group || group.controller !== actorId) return reject('forbidden_controller')
  if (state.phase !== 'action') return reject('phase_mismatch')
  if (state.activeGroupId !== group.id) return reject('not_active_group')
  const order = state.actionOrder
  const index = order.indexOf(group.id)
  let nextActive: string | null = null
  for (let i = index + 1; i < order.length; i++) {
    const candidate = groupById(state, order[i])
    if (candidate && candidate.status === 'active') {
      nextActive = candidate.id
      break
    }
  }
  return accepted(
    { ...state, activeGroupId: nextActive },
    { type: 'turn-advanced', rngIndex: state.rngIndex, fromGroupId: group.id, toGroupId: nextActive },
  )
}

/** 战果条件：任一方已无 active 战斗群（全灭/撤退/投降）。 */
export function isEngagementOver(state: BattleState): boolean {
  const playerActive = state.battleGroups.some((g) => g.faction === 'player' && g.status === 'active')
  const enemyActive = state.battleGroups.some((g) => g.faction === 'enemy' && g.status === 'active')
  return !playerActive || !enemyActive
}

function reduceResolveEngagement(state: BattleState, actorId: string): ReduceResult {
  const isController = state.battleGroups.some((group) => group.controller === actorId)
  if (!isController) return reject('forbidden_controller')
  if (!isEngagementOver(state)) return reject('command_invalid')
  const { outcome, survivorsRatio } = computeOutcome(state)
  const next: BattleState = { ...state, phase: 'completed', outcome }
  const event: BattleEvent = {
    type: 'engagement-completed',
    rngIndex: state.rngIndex,
    outcome,
    survivorsRatio,
    battleGroups: state.battleGroups.map((group) => ({
      id: group.id,
      status: group.status,
      shipsRemaining: activeShips(group).length,
    })),
  }
  return accepted(next, event)
}

export function computeOutcome(state: BattleState): { outcome: NonNullable<BattleState['outcome']>; survivorsRatio: number } {
  const playerGroups = state.battleGroups.filter((group) => group.faction === 'player')
  const enemyGroups = state.battleGroups.filter((group) => group.faction === 'enemy')
  const total = playerGroups.reduce((sum, g) => sum + allShips(g).length, 0)
  const survivors = playerGroups.reduce((sum, g) => sum + activeShips(g).length, 0)
  const survivorsRatio = total === 0 ? 0 : survivors / total

  const playerAlive = playerGroups.some((g) => g.status === 'active')
  const enemyAlive = enemyGroups.some((g) => g.status === 'active')
  const playerWins = !enemyAlive && playerAlive

  if (playerWins) {
    if (survivorsRatio >= 0.75) return { outcome: 'decisive-victory', survivorsRatio }
    if (survivorsRatio >= 0.5) return { outcome: 'strategic-victory', survivorsRatio }
    return { outcome: 'pyrrhic-victory', survivorsRatio }
  }
  if (survivorsRatio >= 0.5) return { outcome: 'strategic-defeat', survivorsRatio }
  return { outcome: 'decisive-defeat', survivorsRatio }
}

/** 战群全灭判定：active 状态但所有舰船 destroyed/disabled → eliminated。 */
export function markEliminatedGroups(state: BattleState): BattleState {
  return {
    ...state,
    battleGroups: state.battleGroups.map((group) => {
      if (group.status !== 'active') return group
      const allDown = allShips(group).every((ship) => ship.status !== 'active')
      return allDown ? { ...group, status: 'eliminated' as const } : group
    }),
  }
}

/** 临界点坍缩（原作 P45）：第 6/7/8 轮起始强制移动。 */
export function applyCollapse(state: BattleState, round: number): BattleState {
  let next = state
  if (round >= 8) {
    next = {
      ...next,
      battleGroups: next.battleGroups.map((g) => ({ ...g, distance: 0 })),
    }
  } else if (round >= 7) {
    next = {
      ...next,
      battleGroups: next.battleGroups.map((g) => ({ ...g, distance: Math.min(g.distance, 2) })),
    }
  } else if (round >= 6) {
    next = {
      ...next,
      battleGroups: next.battleGroups.map((g) => ({ ...g, distance: Math.min(g.distance, 4) })),
    }
  }
  return next
}

function accepted(state: BattleState, event: BattleEvent): ReduceResult {
  return { kind: 'accepted', state, events: [event] }
}

function finish(ctx: EngineContext, state: BattleState): ReduceResult {
  return { kind: 'accepted', state: { ...state, rngIndex: ctx.rngIndex }, events: ctx.events }
}

function noopRng(): Rng {
  return { nextRandom: () => 0 }
}
