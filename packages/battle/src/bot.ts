import type { HullType } from '@fleet-campaign/content'

import type { BattleCommand, BattleGroupState, BattleState, BattleWeaponState } from './types'

/**
 * M2-D NPC 状态机 bot（确定性基础版）。
 *
 * 设计：无内部记忆的派生有限状态机——每个决策回合从当前领域状态推导
 * 出 FSM 相位，再映射为命令。因此同一种子 + 同命令序列 ⇒ 完全可复现，
 * 不引入随机数，也不破坏引擎的确定性契约。
 *
 * 按战斗群"主导舰种"分档（全舰按 type 计数取最多者）：
 * - battleship-line 战列线：逼近近距（0–2 带），超重/双武器齐射。
 * - carrier-kite    航母风筝：维持中长距（3–4 带），酬载/主炮持续压制。
 * - frigate-screen  巡防屏卫：保持 2–3 带灵活机动，视距离进退。
 */

export type BotArchetype = 'battleship-line' | 'carrier-kite' | 'frigate-screen'

export type BotPhase = 'advance' | 'engage' | 'close' | 'approach' | 'hold' | 'disengage' | 'fallback' | 'retreat-declare' | 'idle'

export interface DerivedBotState {
  archetype: BotArchetype
  phase: BotPhase
  distance: number
  preferred: { lo: number; hi: number }
  flagshipHpRatio: number
  enemyFlagshipAlive: boolean
}

export const ARCHETYPE_LABEL: Record<BotArchetype, string> = {
  'battleship-line': '战列线',
  'carrier-kite': '航母风筝',
  'frigate-screen': '巡防屏卫',
}

const PREFERRED_BANDS: Record<BotArchetype, { lo: number; hi: number }> = {
  'battleship-line': { lo: 0, hi: 2 },
  'carrier-kite': { lo: 3, hi: 4 },
  'frigate-screen': { lo: 2, hi: 3 },
}

/** 撤退触发：临界点后，己方旗舰血量低于 34% 且敌方旗舰仍在。 */
export const RETREAT_HP_RATIO = 0.34

function allShips(group: BattleGroupState) {
  return [group.flagship, ...group.ships]
}

export function dominantArchetype(group: BattleGroupState): BotArchetype {
  const counts: Record<HullType, number> = { frigate: 0, carrier: 0, battleship: 0 }
  for (const ship of allShips(group)) counts[ship.type] += 1
  const max = Math.max(counts.frigate, counts.carrier, counts.battleship)
  if (max === counts.battleship) return 'battleship-line'
  if (max === counts.carrier) return 'carrier-kite'
  return 'frigate-screen'
}

export function deriveBotState(state: BattleState, groupId: string): DerivedBotState {
  const group = state.battleGroups.find((g) => g.id === groupId)
  if (!group) throw new Error(`bot: unknown battle group ${groupId}`)
  const archetype = dominantArchetype(group)
  const preferred = PREFERRED_BANDS[archetype]
  const flagshipHpRatio = group.flagship.maxHp > 0 ? group.flagship.hp / group.flagship.maxHp : 0
  const enemy = state.battleGroups.find((g) => g.id !== groupId && g.faction !== group.faction)
  const enemyFlagshipAlive = enemy ? enemy.flagship.status === 'active' : false

  let phase: BotPhase = 'idle'
  const inPreferred = group.distance >= preferred.lo && group.distance <= preferred.hi

  if (group.status !== 'active') {
    phase = 'idle'
  } else if (state.round >= 5 && flagshipHpRatio < RETREAT_HP_RATIO && enemyFlagshipAlive) {
    phase = 'retreat-declare'
  } else if (archetype === 'battleship-line') {
    if (group.distance > preferred.hi) phase = 'advance'
    else if (inPreferred && canFireAny(group)) phase = 'engage'
    else if (inPreferred) phase = 'close'
    else phase = 'advance'
  } else if (archetype === 'carrier-kite') {
    if (group.distance > preferred.hi) phase = 'approach'
    else if (inPreferred) phase = 'hold'
    else phase = 'disengage'
  } else {
    // frigate-screen
    if (group.distance > preferred.hi) phase = 'advance'
    else if (inPreferred) phase = 'hold'
    else phase = 'fallback'
  }

  return { archetype, phase, distance: group.distance, preferred, flagshipHpRatio, enemyFlagshipAlive }
}

/**
 * 撤退意图（供后勤阶段的整合流程调用）：临界点后旗舰血量不足且敌方旗舰仍在。
 * 只在 `phase === 'logistics'` 时合法（引擎 reduceDeclareRetreat 要求）。
 */
export function botWantsToRetreat(state: BattleState, groupId: string): boolean {
  const group = state.battleGroups.find((g) => g.id === groupId)
  if (!group || group.status !== 'active') return false
  return deriveBotState(state, groupId).phase === 'retreat-declare'
}

/** 群内可发射的非充能武器（充能武器走弹着阶段 fire-charged，不在此列）。 */
export function firableWeapons(group: BattleGroupState): BattleWeaponState[] {
  return allShips(group).flatMap((ship) => ship.weapons.filter((w) => w.charge === null))
}

function canFireAny(group: BattleGroupState): boolean {
  return firableWeapons(group).some((w) => group.distance <= w.range)
}

function firstTarget(state: BattleState, group: BattleGroupState): { groupId: string; shipId: string } | null {
  const enemy = state.battleGroups.find((g) => g.id !== group.id && g.faction !== group.faction && g.status === 'active')
  if (!enemy) return null
  if (enemy.flagship.status === 'active') return { groupId: enemy.id, shipId: enemy.flagship.id }
  const alive = [enemy.flagship, ...enemy.ships].find((s) => s.status === 'active')
  if (!alive) return null
  return { groupId: enemy.id, shipId: alive.id }
}

/** 从群内武器里选"1 主武器"（full-thrust 限制）或"1 超重 / 至多 2 不同武器"（all-guns-fire 限制）。 */
function buildAttacks(
  group: BattleGroupState,
  target: { groupId: string; shipId: string } | null,
  mode: 'single-main' | 'all-guns',
): Extract<BattleCommand, { type: 'maneuver' }>['attacks'] {
  if (!target) return []
  // 按 weaponId 去重（同目录武器可装在多舰上，但一条命令不能重复同一武器）。
  const unique = new Map<string, BattleWeaponState>()
  for (const w of firableWeapons(group)) {
    if (group.distance <= w.range && !unique.has(w.weaponId)) unique.set(w.weaponId, w)
  }
  const weapons = [...unique.values()]

  if (mode === 'single-main') {
    const main = weapons.find((w) => w.size === 'main')
    if (!main) return []
    return [{ weaponId: main.weaponId, target }]
  }

  const superheavy = weapons.find((w) => w.size === 'superheavy')
  if (superheavy) return [{ weaponId: superheavy.weaponId, target }]
  // all-guns-fire 只允许 1 超重 或 至多 2 不同武器；单非超重不合法 → 空（不开火）。
  const two = weapons.slice(0, 2)
  if (two.length < 2) return []
  return two.map((w) => ({ weaponId: w.weaponId, target }))
}

/**
 * 派生状态机 → 行动命令。返回该战斗群本轮行动阶段要执行的一组命令
 * （调用方随后执行 end-turn）。
 */
export function decideBotCommands(state: BattleState, groupId: string): BattleCommand[] {
  const group = state.battleGroups.find((g) => g.id === groupId)
  if (!group || group.status !== 'active') return []
  const { archetype, phase } = deriveBotState(state, groupId)
  const commands: BattleCommand[] = []
  const base = { actorId: group.controller, battleGroupId: group.id }
  const target = firstTarget(state, group)

  // 撤退不作为行动命令下发（引擎只在后勤阶段接受 declare-retreat）；
  // 由整合流程用 botWantsToRetreat 在后勤阶段单独处理。
  if (phase === 'retreat-declare') {
    return []
  }

  switch (archetype) {
    case 'battleship-line': {
      if (phase === 'advance') {
        const attacks = buildAttacks(group, target, 'single-main')
        commands.push({ type: 'maneuver', ...base, maneuver: 'full-thrust', attacks })
      } else if (phase === 'engage') {
        const attacks = buildAttacks(group, target, 'all-guns')
        commands.push({ type: 'maneuver', ...base, maneuver: 'all-guns-fire', attacks })
      } else {
        // close：距离合适但没有可发射武器，直接逼近。
        commands.push({ type: 'maneuver', ...base, maneuver: 'full-thrust' })
      }
      break
    }
    case 'carrier-kite': {
      if (phase === 'approach') {
        commands.push({ type: 'maneuver', ...base, maneuver: 'full-thrust' })
      } else if (phase === 'hold') {
        const attacks = buildAttacks(group, target, 'all-guns')
        commands.push({ type: 'maneuver', ...base, maneuver: 'all-guns-fire', attacks })
      } else {
        // disengage：拉远。
        commands.push({ type: 'maneuver', ...base, maneuver: 'retro-thrust', retreat: true })
      }
      break
    }
    case 'frigate-screen': {
      if (phase === 'advance') {
        commands.push({ type: 'maneuver', ...base, maneuver: 'full-thrust' })
      } else if (phase === 'hold') {
        const attacks = buildAttacks(group, target, 'all-guns')
        commands.push({ type: 'maneuver', ...base, maneuver: 'all-guns-fire', attacks })
      } else {
        commands.push({ type: 'maneuver', ...base, maneuver: 'retro-thrust', retreat: true })
      }
      break
    }
  }
  return commands
}
