import { describe, expect, it } from 'vitest'

import { buildBattleContent, type BattleGroupBuild } from '@fleet-campaign/content'

import { botWantsToRetreat, createSeededRng, decideBotCommands, deriveBotState, dominantArchetype, reduceCommand, RETREAT_HP_RATIO, startEngagement, type BattleState } from './index'

function buildState(groups: BattleGroupBuild[]): BattleState {
  const result = buildBattleContent('bot-test', groups)
  if (!result.ok) throw new Error(`build failed: ${result.errors.join('; ')}`)
  const started = startEngagement(result.value, 'bot-test')
  if (started.kind !== 'accepted') throw new Error(`start failed: ${started.rejection.code}`)
  return started.state
}

/** 推进到行动阶段（后勤→弹着→行动）。 */
function toActionPhase(state: BattleState): BattleState {
  const rng = createSeededRng(0xfedcn)
  let current = state
  for (let i = 0; i < 2; i++) {
    const r = reduceCommand(current, { type: 'advance-phase', actorId: current.battleGroups[0].controller }, rng)
    if (r.kind === 'accepted') current = r.state
  }
  return current
}

function battleshipBuild(id = 'player-group'): BattleGroupBuild {
  return {
    id,
    faction: 'player',
    startingDistance: 4,
    ships: [
      { hullId: 'h-bulwark', flag: true, weaponIds: ['w-spike', 'w-bolt'] },
      { hullId: 'h-dart', weaponIds: ['w-spike'] },
    ],
  }
}

function carrierBuild(id = 'enemy-group'): BattleGroupBuild {
  return {
    id,
    faction: 'enemy',
    startingDistance: 4,
    ships: [
      { hullId: 'h-hive', flag: true, weaponIds: ['w-grapple', 'w-sweep'] },
      { hullId: 'h-hive', weaponIds: ['w-grapple'] },
    ],
  }
}

function frigateBuild(id = 'player-group'): BattleGroupBuild {
  return {
    id,
    faction: 'player',
    startingDistance: 2,
    ships: [
      { hullId: 'h-arrow', flag: true, weaponIds: ['w-sweep'] },
      { hullId: 'h-dart', weaponIds: ['w-sweep'] },
      { hullId: 'h-dart', weaponIds: [] },
    ],
  }
}

describe('dominantArchetype', () => {
  it('classifies a battleship-majority group as battleship-line', () => {
    const state = buildState([battleshipBuild(), carrierBuild()])
    const group = state.battleGroups[0]
    expect(dominantArchetype(group)).toBe('battleship-line')
  })

  it('classifies a carrier-majority group as carrier-kite', () => {
    const state = buildState([carrierBuild('player-group'), battleshipBuild('enemy-group')])
    const group = state.battleGroups[0]
    expect(dominantArchetype(group)).toBe('carrier-kite')
  })

  it('classifies a frigate-majority group as frigate-screen', () => {
    const state = buildState([frigateBuild(), battleshipBuild('enemy-group')])
    const group = state.battleGroups[0]
    expect(dominantArchetype(group)).toBe('frigate-screen')
  })
})

describe('battleship-line FSM', () => {
  it('advances toward the enemy from long range', () => {
    const state = toActionPhase(buildState([battleshipBuild(), carrierBuild()]))
    const derived = deriveBotState(state, 'player-group')
    expect(derived.archetype).toBe('battleship-line')
    expect(derived.phase).toBe('advance')
    const commands = decideBotCommands(state, 'player-group')
    expect(commands[0]).toMatchObject({ type: 'maneuver', maneuver: 'full-thrust' })
  })

  it('enters engage phase within preferred band and fires all guns', () => {
    // 直接在行动阶段把距离带到 2（engage 判定只依赖距离）。
    const state = toActionPhase(buildState([battleshipBuild(), carrierBuild()]))
    const close = {
      ...state,
      battleGroups: state.battleGroups.map((g) => (g.id === 'player-group' ? { ...g, distance: 2 } : g)),
    }
    const derived = deriveBotState(close, 'player-group')
    expect(derived.phase).toBe('engage')
    const commands = decideBotCommands(close, 'player-group')
    expect(commands[0]).toMatchObject({ type: 'maneuver', maneuver: 'all-guns-fire' })
  })
})

describe('carrier-kite FSM', () => {
  it('disengages when the enemy closes in', () => {
    const state = buildState([carrierBuild('player-group'), battleshipBuild('enemy-group')])
    // 敌人已贴到 1 带（直接改距离模拟）。
    const close = {
      ...state,
      battleGroups: state.battleGroups.map((g) => (g.id === 'player-group' ? { ...g, distance: 1 } : g)),
    }
    const derived = deriveBotState(close, 'player-group')
    expect(derived.phase).toBe('disengage')
    const commands = decideBotCommands(close, 'player-group')
    expect(commands[0]).toMatchObject({ type: 'maneuver', maneuver: 'retro-thrust', retreat: true })
  })

  it('holds at preferred band and keeps firing', () => {
    const state = buildState([carrierBuild('player-group'), battleshipBuild('enemy-group')])
    const derived = deriveBotState(state, 'player-group')
    expect(derived.phase).toBe('hold')
    const commands = decideBotCommands(state, 'player-group')
    expect(commands[0]).toMatchObject({ type: 'maneuver', maneuver: 'all-guns-fire' })
  })
})

describe('frigate-screen FSM', () => {
  it('falls back when enemies press to short range', () => {
    const state = buildState([frigateBuild(), battleshipBuild('enemy-group')])
    const close = {
      ...state,
      battleGroups: state.battleGroups.map((g) => (g.id === 'player-group' ? { ...g, distance: 1 } : g)),
    }
    const derived = deriveBotState(close, 'player-group')
    expect(derived.phase).toBe('fallback')
    const commands = decideBotCommands(close, 'player-group')
    expect(commands[0]).toMatchObject({ type: 'maneuver', maneuver: 'retro-thrust', retreat: true })
  })

  it('advances when far away', () => {
    const state = buildState([frigateBuild(), battleshipBuild('enemy-group')])
    const far = {
      ...state,
      battleGroups: state.battleGroups.map((g) => (g.id === 'player-group' ? { ...g, distance: 4 } : g)),
    }
    const derived = deriveBotState(far, 'player-group')
    expect(derived.phase).toBe('advance')
  })
})

describe('retreat judgment', () => {
  it('declares retreat past the critical point with a crippled flagship', () => {
    const state = buildState([battleshipBuild(), carrierBuild()])
    const hurt = {
      ...state,
      round: 5,
      battleGroups: state.battleGroups.map((g) =>
        g.id === 'player-group' ? { ...g, flagship: { ...g.flagship, hp: 3, maxHp: 15 } } : g,
      ),
    }
    const derived = deriveBotState(hurt, 'player-group')
    expect(derived.phase).toBe('retreat-declare')
    expect(botWantsToRetreat(hurt, 'player-group')).toBe(true)
    // 撤退不作为行动命令下发（由后勤阶段的整合流程处理）。
    expect(decideBotCommands(hurt, 'player-group')).toEqual([])
  })

  it('does not retreat before the critical point', () => {
    const state = buildState([battleshipBuild(), carrierBuild()])
    const hurt = {
      ...state,
      round: 4,
      battleGroups: state.battleGroups.map((g) =>
        g.id === 'player-group' ? { ...g, flagship: { ...g.flagship, hp: 3, maxHp: 15 } } : g,
      ),
    }
    const derived = deriveBotState(hurt, 'player-group')
    expect(derived.phase).not.toBe('retreat-declare')
    expect(botWantsToRetreat(hurt, 'player-group')).toBe(false)
  })

  it('exposes the configured retreat threshold', () => {
    expect(RETREAT_HP_RATIO).toBe(0.34)
  })
})

describe('determinism', () => {
  it('returns identical decisions for identical state', () => {
    const state = buildState([battleshipBuild(), carrierBuild()])
    expect(decideBotCommands(state, 'player-group')).toEqual(decideBotCommands(state, 'player-group'))
    expect(deriveBotState(state, 'player-group')).toEqual(deriveBotState(state, 'player-group'))
  })
})

describe('command legality', () => {
  it('emits commands the engine accepts in the action phase', () => {
    // 推进到行动阶段，跑几个回合，确认 bot 每条命令都被引擎接受。
    let state = buildState([battleshipBuild(), carrierBuild()])
    const rng = createSeededRng(125800n)
    let accepted = 0
    let rejected = 0
    for (let i = 0; i < 12; i++) {
      if (state.phase === 'completed') break
      if (state.phase === 'logistics' || state.phase === 'ballistics' || state.phase === 'boarding') {
        const r = reduceCommand(state, { type: 'advance-phase', actorId: 'player' }, rng)
        if (r.kind === 'accepted') state = r.state
        continue
      }
      const groupId = state.activeGroupId
      if (!groupId) continue
      const controller = state.battleGroups.find((g) => g.id === groupId)!.controller
      for (const cmd of decideBotCommands(state, groupId)) {
        const r = reduceCommand(state, cmd, rng)
        if (r.kind === 'accepted') {
          state = r.state
          accepted += 1
        } else {
          rejected += 1
        }
      }
      const end = reduceCommand(state, { type: 'end-turn', actorId: controller, battleGroupId: groupId })
      if (end.kind === 'accepted') state = end.state
    }
    expect(rejected).toBe(0)
    expect(accepted).toBeGreaterThan(0)
  })
})
