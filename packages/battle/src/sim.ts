import { buildBattleContent, type BattleContent, type BattleGroupBuild } from '@fleet-campaign/content'

import { ARCHETYPE_LABEL, createSeededRng, decideBotCommands, deriveBotState, isEngagementOver, markEliminatedGroups, reduceCommand, startEngagement } from './index'
import type { BattleCommand, BattleEvent, BattleGroupState, BattleState } from './types'

/**
 * M2-A 控制台交战沙盒：用固定种子 + 脚本化策略跑一场完整交战，批量打印
 * 每阶段/每行动/每骰子/每事件与最终战果，用于人工核对引擎行为与确定性。
 */

export interface SimOptions {
  seed: bigint
  /** 最大轮数，默认 8（临界点坍缩完毕）。 */
  maxRounds?: number
  /** 打印事件明细，默认 true。 */
  verbose?: boolean
}

export function defaultFleets(): BattleGroupBuild[] {
  return [
    {
      id: 'player-group',
      faction: 'player',
      startingDistance: 3,
      ships: [
        { hullId: 'h-bulwark', flag: true, weaponIds: ['w-spike', 'w-bolt'] },
        { hullId: 'h-dart', weaponIds: ['w-sweep'] },
      ],
    },
    {
      id: 'enemy-group',
      faction: 'enemy',
      startingDistance: 3,
      ships: [
        { hullId: 'h-hive', flag: true, weaponIds: ['w-grapple', 'w-sweep'] },
        { hullId: 'h-arrow', weaponIds: ['w-spike'] },
      ],
    },
  ]
}

export function buildSimContent(groups: BattleGroupBuild[] = defaultFleets()): BattleContent {
  const result = buildBattleContent('battle-sim-v1', groups)
  if (!result.ok) throw new Error(`sim content build failed: ${result.errors.join('; ')}`)
  return result.value
}

function shipLabel(group: BattleGroupState, shipId: string): string {
  if (group.flagship.id === shipId) return `${shipId}★`
  const ship = group.ships.find((s) => s.id === shipId)
  return ship ? ship.id : shipId
}

function describeGroup(state: BattleState, group: BattleGroupState): string {
  const ships = [group.flagship, ...group.ships]
    .map((s) => `${s.id}(${s.hp}/${s.maxHp}${s.status === 'active' ? '' : '/' + s.status})`)
    .join(' ')
  const archetype = `  [bot: ${ARCHETYPE_LABEL[deriveBotState(state, group.id).archetype]}]`
  return `[${group.id} ${group.faction} 带${group.distance} 阻滞${group.blockDice}d6 ${ships}]${archetype}`
}

function describeEvent(state: BattleState, event: BattleEvent): string {
  switch (event.type) {
    case 'engagement-started':
      return `交战开始 round ${event.round}`
    case 'round-started':
      return `第 ${event.round} 轮 进入后勤`
    case 'phase-advanced':
      return `  阶段 ${event.from} → ${event.to}`
    case 'turn-advanced':
      return `  turn ${event.fromGroupId} → ${event.toGroupId ?? '结束'}`
    case 'counter-tick': {
      return `  计数[${event.battleGroupId}/${event.weaponId}] 充能${event.charge ?? '-'} 飞行${event.flight ?? '-'} 装填${event.reload ?? '-'}`
    }
    case 'charged-fired':
      return `  充能开火 ${event.battleGroupId}/${event.weaponId} → ${event.target.groupId}/${event.target.shipId}`
    case 'charged-delayed':
      return `  充能延后 ${event.battleGroupId}/${event.weaponId}`
    case 'attack-resolved': {
      const group = state.battleGroups.find((g) => g.id === event.attackerGroupId)
      if (event.roll === 0) {
        return `  ⚔ [区域] ${event.attackerGroupId}/${event.weaponId} 自动命中`
      }
      const label = group ? shipLabel(group, event.targetShipId) : event.targetShipId
      const outcome = event.hit ? (event.crit ? '会心命中' : '命中') : '未命中'
      return `  ⚔ ${event.attackerGroupId}/${event.weaponId} → ${label}: 1d20=${event.roll} 准度+${event.accuracyBonus} 难度-${event.difficultyPenalty} = ${event.total} vs 防御${event.defense} [${outcome}] rng@${event.rngIndex}`
    }
    case 'damage-applied': {
      const group = state.battleGroups.find((g) => g.id === event.targetGroupId)
      const label = group ? shipLabel(group, event.targetShipId) : event.targetShipId
      const fate = event.destroyed ? ' 击毁!' : event.disabled ? ' 瘫痪' : ''
      return `  伤害 ${label} 扣 ${event.net}（原${event.gross} 阻滞${event.blocked}）${fate}`
    }
    case 'block-rolled':
      return `  阻滞[${event.battleGroupId}] ${event.blockDice}d6 = ${event.roll}`
    case 'maneuver-performed':
      return `  机动[${event.battleGroupId}] ${event.maneuver} 距离 ${event.distanceBefore}→${event.distanceAfter}`
    case 'tactic-performed':
      return `  战术[${event.battleGroupId}] ${event.tactic}`
    case 'status-applied':
      return `  状态[${event.battleGroupId}] ${event.status}`
    case 'retreat-declared':
      return `  撤退 [${event.battleGroupId}]`
    case 'surrender-declared':
      return `  投降 [${event.battleGroupId}]`
    case 'ship-destroyed': {
      const group = state.battleGroups.find((g) => g.id === event.battleGroupId)
      const label = group ? shipLabel(group, event.shipId) : event.shipId
      return `  💥 ${label} 被击毁`
    }
    case 'ship-disabled': {
      const group = state.battleGroups.find((g) => g.id === event.battleGroupId)
      const label = group ? shipLabel(group, event.shipId) : event.shipId
      return `  ⚡ ${label} 被瘫痪`
    }
    case 'engagement-completed':
      return `战果：${event.outcome}（幸存 ${event.survivorsRatio}）`
    default:
      return `  ${event.type}`
  }
}

/** 脚本化策略：回合制交替，机动 + 开火（玩家方先手）。由 M2-D 状态机 bot 驱动。 */
function scriptTurn(state: BattleState, groupId: string): BattleCommand[] {
  return decideBotCommands(state, groupId)
}

/** 脚本化整场交战，返回最终状态与事件流。一方战果达成即结束。 */
export function runSimulation(content: BattleContent, options: SimOptions): { state: BattleState; events: BattleEvent[] } {
  const maxRounds = options.maxRounds ?? 8
  const rng = createSeededRng(options.seed)
  const started = startEngagement(content, 'sim-engagement')
  if (started.kind !== 'accepted') throw new Error(`sim start failed: ${started.rejection.code}`)
  let state = started.state
  const events: BattleEvent[] = [...started.events]

  for (let step = 0; step < 2000; step++) {
    if (state.phase === 'completed') break
    if (isEngagementOver(markEliminatedGroups(state))) {
      const result = reduceCommand(state, { type: 'resolve-engagement', actorId: 'player' }, rng)
      if (result.kind === 'accepted') {
        state = result.state
        events.push(...result.events)
      }
      break
    }
    if (state.round > maxRounds) {
      state = markEliminatedGroups(state)
      const result = reduceCommand(state, { type: 'resolve-engagement', actorId: 'player' }, rng)
      if (result.kind === 'accepted') {
        state = result.state
        events.push(...result.events)
      }
      break
    }

    if (state.phase === 'logistics') {
      const result = reduceCommand(state, { type: 'advance-phase', actorId: 'player' }, rng)
      if (result.kind !== 'accepted') throw new Error(`advance rejected: ${result.rejection.code}`)
      state = result.state
      events.push(...result.events)
    } else if (state.phase === 'ballistics') {
      // 充能到 0 的开火，其余延后。
      const active = state.battleGroups.filter((g) => g.status === 'active')
      const charged = active
        .flatMap((g) => [g.flagship, ...g.ships].flatMap((s) => s.weapons.map((w) => ({ g, w }))))
        .filter(({ w }) => w.charge !== null && w.charge === 0)
      for (const { g, w } of charged) {
        const target = state.battleGroups.find((x) => x.id !== g.id)
        if (!target || target.status !== 'active') continue
        const targetShip = target.flagship.status === 'active' ? target.flagship.id : target.ships.find((s) => s.status === 'active')?.id
        if (!targetShip) continue
        const result = reduceCommand(
          state,
          { type: 'fire-charged', actorId: g.controller, battleGroupId: g.id, weaponId: w.weaponId, target: { groupId: target.id, shipId: targetShip } },
          rng,
        )
        if (result.kind === 'accepted') {
          state = result.state
          events.push(...result.events)
        }
      }
      const result = reduceCommand(state, { type: 'advance-phase', actorId: 'player' }, rng)
      if (result.kind !== 'accepted') throw new Error(`advance from ballistics rejected: ${result.rejection.code}`)
      state = result.state
      events.push(...result.events)
    } else if (state.phase === 'action') {
      const groupId = state.activeGroupId
      if (!groupId) {
        const result = reduceCommand(state, { type: 'advance-phase', actorId: 'player' }, rng)
        if (result.kind !== 'accepted') throw new Error(`advance from action rejected: ${result.rejection.code}`)
        state = result.state
        events.push(...result.events)
        continue
      }
      const cmds = scriptTurn(state, groupId)
      for (const cmd of cmds) {
        const result = reduceCommand(state, cmd, rng)
        if (result.kind === 'accepted') {
          state = result.state
          events.push(...result.events)
        }
      }
      const end = reduceCommand(state, { type: 'end-turn', actorId: state.battleGroups.find((g) => g.id === groupId)!.controller, battleGroupId: groupId })
      if (end.kind !== 'accepted') throw new Error(`end-turn rejected: ${end.rejection.code}`)
      state = end.state
      events.push(...end.events)
    } else if (state.phase === 'boarding') {
      const result = reduceCommand(state, { type: 'advance-phase', actorId: 'player' }, rng)
      if (result.kind !== 'accepted') throw new Error(`advance from boarding rejected: ${result.rejection.code}`)
      state = result.state
      events.push(...result.events)
    }
  }

  return { state, events }
}

/** 打印整场交战的文本日志。 */
export function formatSimulation(content: BattleContent, options: SimOptions): string {
  const { state, events } = runSimulation(content, options)
  const lines: string[] = []
  lines.push(`seed=${options.seed.toString()}  content=${content.contentId}  maxRounds=${options.maxRounds ?? 8}`)
  lines.push('')
  for (const group of state.battleGroups) {
    lines.push(describeGroup(state, group))
  }
  lines.push('')
  for (const event of events) {
    if (event.type === 'counter-tick' && !options.verbose) continue
    lines.push(describeEvent(state, event))
  }
  lines.push('')
  lines.push(`最终：rngIndex=${state.rngIndex}`)
  for (const group of state.battleGroups) lines.push(describeGroup(state, group))
  if (state.phase === 'completed') {
    lines.push(`战果：${state.outcome}`)
  } else {
    lines.push(`未结束：phase=${state.phase} round=${state.round}`)
  }
  return lines.join('\n')
}
