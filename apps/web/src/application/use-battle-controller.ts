import { useCallback, useMemo, useRef, useState } from 'react'

import { buildBattleContent, type BattleGroupBuild } from '@fleet-campaign/content'

import {
  botWantsToRetreat,
  createSeededRng,
  decideBotCommands,
  isEngagementOver,
  reduceCommand,
  startEngagement,
  type BattleCommand,
  type BattleEvent,
  type BattleState,
} from '@fleet-campaign/battle'

/** M2-E 单指挥沙盒默认双方舰队（可由构筑器替换）。 */
export function battleDefaultFleets(): BattleGroupBuild[] {
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

export interface BattleController {
  state: BattleState
  events: BattleEvent[]
  seed: bigint
  /** 玩家推进阶段；同时自动驱动敌方 bot 回合与弹着充能开火。 */
  advancePhase: () => void
  /** 玩家执行机动/战术等行动命令。 */
  submit: (command: BattleCommand) => void
  /** 玩家结束自己的行动回合（随后自动跑敌方 bot）。 */
  endTurn: () => void
  /** 弹着阶段：对己方充能到 0 的武器开火（自动选敌方首目标）。 */
  fireCharged: (weaponId: string) => void
  /** 新开一局（更换种子）。 */
  reset: () => void
  /** 玩家可发射的充能武器（弹着阶段 charge===0）。 */
  playerReadyCharged: { weaponId: string; shipId: string }[]
  /** 最后一条被拒绝命令的码（供 UI 提示）。 */
  lastRejection: string | null
}

function groupById(state: BattleState, id: string) {
  return state.battleGroups.find((g) => g.id === id)
}

function allShips(group: BattleState['battleGroups'][number]) {
  return [group.flagship, ...group.ships]
}

/** 引擎校验后的目标选择：打敌方旗�*，否则第一艘存活舰。 */
function firstEnemyTarget(state: BattleState, groupId: string) {
  const group = groupById(state, groupId)
  if (!group) return null
  const enemy = state.battleGroups.find((g) => g.id !== groupId && g.faction !== group.faction && g.status === 'active')
  if (!enemy) return null
  if (enemy.flagship.status === 'active') return { groupId: enemy.id, shipId: enemy.flagship.id }
  const alive = allShips(enemy).find((s) => s.status === 'active')
  if (!alive) return null
  return { groupId: enemy.id, shipId: alive.id }
}

export function useBattleController(initialFleets: () => BattleGroupBuild[] = battleDefaultFleets): BattleController {
  const [seed, setSeed] = useState<bigint>(() => BigInt(Math.floor(Math.random() * 0xffffff) + 1))
  const [state, setState] = useState<BattleState>(() => makeInitial(initialFleets(), seed))
  const [events, setEvents] = useState<BattleEvent[]>([])
  const [lastRejection, setLastRejection] = useState<string | null>(null)
  const stateRef = useRef(state)
  const rngRef = useRef(createSeededRng(seed))

  function makeInitial(fleets: BattleGroupBuild[], s: bigint): BattleState {
    const result = buildBattleContent(`battle-web-${s}`, fleets)
    if (!result.ok) throw new Error(`build failed: ${result.errors.join('; ')}`)
    const started = startEngagement(result.value, `web-${s}`)
    if (started.kind !== 'accepted') throw new Error(`start failed: ${started.rejection.code}`)
    return started.state
  }

  function commit(next: BattleState, newEvents: BattleEvent[]): void {
    stateRef.current = next
    setState(next)
    if (newEvents.length > 0) setEvents((prev) => [...prev, ...newEvents])
  }

  function runCommand(command: BattleCommand): boolean {
    const result = reduceCommand(stateRef.current, command, rngRef.current)
    if (result.kind === 'accepted') {
      commit(result.state, result.events)
      setLastRejection(null)
      return true
    }
    setLastRejection(result.rejection.code)
    return false
  }

  const driveBot = useCallback(() => {
    let guard = 0
    while (guard++ < 50) {
      const s = stateRef.current
      if (s.phase === 'completed') return
      if (s.phase === 'action') {
        if (!s.activeGroupId) {
          // 全员已行动，推进出行动阶段。
          runCommand({ type: 'advance-phase', actorId: 'player' })
          continue
        }
        const g = groupById(s, s.activeGroupId)
        if (!g) return
        if (g.faction === 'enemy') {
          for (const cmd of decideBotCommands(s, g.id)) runCommand(cmd)
          runCommand({ type: 'end-turn', actorId: 'enemy', battleGroupId: g.id })
          continue
        }
        return // 轮到玩家
      }
      if (s.phase === 'ballistics') {
        // 敌方充能到 0 的武器自动开火。
        for (const g of s.battleGroups.filter((x) => x.faction === 'enemy' && x.status === 'active')) {
          for (const ship of allShips(g)) {
            for (const weapon of ship.weapons) {
              if (weapon.charge === null || weapon.charge !== 0) continue
              const target = firstEnemyTarget(stateRef.current, g.id)
              if (!target) continue
              runCommand({
                type: 'fire-charged',
                actorId: 'enemy',
                battleGroupId: g.id,
                weaponId: weapon.weaponId,
                target,
              })
            }
          }
        }
        // 玩家仍有充能到 0 的武器时停在弹着阶段，等玩家从指令坞开火/推进。
        const playerReady = stateRef.current.battleGroups
          .filter((x) => x.faction === 'player' && x.status === 'active')
          .flatMap((g) => allShips(g).flatMap((ship) => ship.weapons.filter((w) => w.charge !== null && w.charge === 0)))
        if (playerReady.length > 0) return
        runCommand({ type: 'advance-phase', actorId: 'player' })
        continue
      }
      if (s.phase === 'logistics') {
        // 临界点后敌方 bot 撤退意图。
        for (const g of s.battleGroups.filter((x) => x.status === 'active' && x.faction === 'enemy')) {
          if (botWantsToRetreat(s, g.id)) {
            runCommand({ type: 'declare-retreat', actorId: 'enemy', battleGroupId: g.id })
          }
        }
        // 用撤退声明后的最新状态判断战果。
        if (isEngagementOver(stateRef.current)) {
          runCommand({ type: 'resolve-engagement', actorId: 'player' })
          return
        }
        runCommand({ type: 'advance-phase', actorId: 'player' })
        continue
      }
      if (s.phase === 'boarding') {
        runCommand({ type: 'advance-phase', actorId: 'player' })
        continue
      }
      return
    }
  }, [])

  const advancePhase = useCallback(() => {
    const s = stateRef.current
    if (s.phase === 'logistics') {
      // 玩家在后勤阶段的撤退意图也尊重（单指挥可手动撤退）。
    }
    runCommand({ type: 'advance-phase', actorId: 'player' })
    driveBot()
  }, [driveBot])

  const submit = useCallback((command: BattleCommand) => {
    runCommand(command)
    driveBot()
  }, [driveBot])

  const endTurn = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'action' || !s.activeGroupId) return
    const g = groupById(s, s.activeGroupId)
    if (!g || g.faction !== 'player') return
    runCommand({ type: 'end-turn', actorId: 'player', battleGroupId: g.id })
    driveBot()
  }, [driveBot])

  const fireCharged = useCallback((weaponId: string) => {
    const s = stateRef.current
    const player = s.battleGroups.find((g) => g.faction === 'player' && g.status === 'active')
    if (!player) return
    const t = firstEnemyTarget(s, player.id)
    if (!t) return
    runCommand({
      type: 'fire-charged',
      actorId: 'player',
      battleGroupId: player.id,
      weaponId,
      target: t,
    })
    driveBot()
  }, [driveBot])

  const reset = useCallback(() => {
    const nextSeed = BigInt(Math.floor(Math.random() * 0xffffff) + 1)
    setSeed(nextSeed)
    rngRef.current = createSeededRng(nextSeed)
    const fresh = makeInitial(initialFleets(), nextSeed)
    stateRef.current = fresh
    setState(fresh)
    setEvents([])
    setLastRejection(null)
  }, [initialFleets])

  const playerReadyCharged = useMemo(() => {
    const player = state.battleGroups.find((g) => g.faction === 'player' && g.status === 'active')
    if (!player || state.phase !== 'ballistics') return []
    const enemy = state.battleGroups.find((g) => g.faction === 'enemy' && g.status === 'active')
    return allShips(player)
      .filter((ship) => ship.status === 'active')
      .flatMap((ship) =>
        ship.weapons
          .filter((w) => w.charge !== null && w.charge === 0 && enemy && player.distance <= w.range)
          .map((w) => ({ weaponId: w.weaponId, shipId: ship.id })),
      )
  }, [state])

  return {
    state,
    events,
    seed,
    advancePhase,
    submit,
    endTurn,
    fireCharged,
    reset,
    playerReadyCharged,
    lastRejection,
  }
}
