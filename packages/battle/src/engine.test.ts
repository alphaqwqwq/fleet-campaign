import { describe, expect, it } from 'vitest'

import { BATTLE_SANDBOX_V1 } from '@fleet-campaign/content'

import { checkInvariants, computeOutcome, createSeededRng, markEliminatedGroups, reduceCommand, startEngagement, type BattleState } from './index'
import type { BattleCommand } from './types'

function seededRun(seed: bigint, steps: BattleCommand[]) {
  const rng = createSeededRng(seed)
  const started = startEngagement(BATTLE_SANDBOX_V1, 'test-engagement')
  if (started.kind !== 'accepted') throw new Error('sandbox content must start')
  let state = started.state
  const events = [...started.events]
  for (const step of steps) {
    const result = reduceCommand(state, step, rng)
    if (result.kind !== 'accepted') throw new Error(`step ${step.type} rejected: ${result.rejection.code}`)
    state = result.state
    events.push(...result.events)
    const violations = checkInvariants(state)
    if (violations.length > 0) throw new Error(`invariants violated after ${step.type}: ${violations.join('; ')}`)
  }
  return { state, events }
}

/** 走完一整轮（logistics→ballistics→action→boarding→下一轮 logistics）。 */
function fullRoundSteps(): BattleCommand[] {
  return [
    { type: 'advance-phase', actorId: 'player' },
    { type: 'advance-phase', actorId: 'player' },
    { type: 'end-turn', actorId: 'player', battleGroupId: 'player-group' },
    { type: 'end-turn', actorId: 'enemy', battleGroupId: 'enemy-group' },
    { type: 'advance-phase', actorId: 'player' },
    { type: 'advance-phase', actorId: 'player' },
  ]
}

function activePhaseState(): BattleState {
  const started = startEngagement(BATTLE_SANDBOX_V1, 'test-engagement')
  if (started.kind !== 'accepted') throw new Error('sandbox must start')
  let state = started.state
  const rng = createSeededRng(0xdeadbeefn)
  for (const step of [
    { type: 'advance-phase', actorId: 'player' },
    { type: 'advance-phase', actorId: 'player' },
  ] as BattleCommand[]) {
    const result = reduceCommand(state, step, rng)
    if (result.kind !== 'accepted') throw new Error('advance to action failed')
    state = result.state
  }
  return state
}

describe('start-engagement', () => {
  it('establishes initial state from sandbox content', () => {
    const result = startEngagement(BATTLE_SANDBOX_V1)
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    expect(result.state.phase).toBe('logistics')
    expect(result.state.round).toBe(1)
    expect(result.state.battleGroups).toHaveLength(2)
    expect(result.state.battleGroups[0].distance).toBe(3)
    expect(result.events[0].type).toBe('engagement-started')
  })

  it('rejects invalid content deterministically', () => {
    const result = startEngagement({ contentId: 'x', kind: 'battle-v1', battleGroups: [] } as never)
    expect(result).toEqual({ kind: 'rejected', rejection: { code: 'content_invalid' } })
  })
})

describe('phase clock', () => {
  it('advances through a full round deterministically', () => {
    const { state } = seededRun(0x1234n, fullRoundSteps())
    expect(state.round).toBe(2)
    expect(state.phase).toBe('logistics')
    expect(state.rngIndex).toBe(0)
  })

  it('cannot advance-phase during action while turns remain', () => {
    const state = activePhaseState()
    const result = reduceCommand(state, { type: 'advance-phase', actorId: 'player' }, createSeededRng(1n))
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('not_all_turns_ended')
  })
})

describe('maneuvers', () => {
  it('full-thrust advances distance toward enemy', () => {
    const state = activePhaseState()
    const result = reduceCommand(
      state,
      { type: 'maneuver', actorId: 'player', battleGroupId: 'player-group', maneuver: 'full-thrust' },
      createSeededRng(2n),
    )
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    const group = result.state.battleGroups.find((g) => g.id === 'player-group')!
    expect(group.distance).toBe(2)
    const maneuverEvent = result.events.find((e) => e.type === 'maneuver-performed')
    expect(maneuverEvent).toMatchObject({ distanceBefore: 3, distanceAfter: 2 })
  })

  it('full-thrust with attack fires a main weapon', () => {
    const state = activePhaseState()
    const result = reduceCommand(
      state,
      {
        type: 'maneuver',
        actorId: 'player',
        battleGroupId: 'player-group',
        maneuver: 'full-thrust',
        attacks: [{ weaponId: 'p-flag-main', target: { groupId: 'enemy-group', shipId: 'e-flag' } }],
      },
      createSeededRng(3n),
    )
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    const attack = result.events.find((e) => e.type === 'attack-resolved')
    expect(attack).toBeDefined()
    expect(result.state.rngIndex).toBeGreaterThan(0)
  })

  it('rejects attack on own faction', () => {
    const state = activePhaseState()
    const result = reduceCommand(
      state,
      {
        type: 'maneuver',
        actorId: 'player',
        battleGroupId: 'player-group',
        maneuver: 'full-thrust',
        attacks: [{ weaponId: 'p-flag-main', target: { groupId: 'player-group', shipId: 'p-flag' } }],
      },
      createSeededRng(4n),
    )
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('no_valid_target')
  })
})

describe('tactics', () => {
  it('emergency-maneuver is limited once per engagement', () => {
    let state = activePhaseState()
    const first = reduceCommand(
      state,
      { type: 'tactic', actorId: 'player', battleGroupId: 'player-group', tactic: 'emergency-maneuver', direction: 'retreat' },
      createSeededRng(5n),
    )
    expect(first.kind).toBe('accepted')
    if (first.kind !== 'accepted') return
    state = first.state
    const second = reduceCommand(
      state,
      { type: 'tactic', actorId: 'player', battleGroupId: 'player-group', tactic: 'emergency-maneuver', direction: 'retreat' },
      createSeededRng(6n),
    )
    expect(second.kind).toBe('rejected')
    if (second.kind !== 'rejected') return
    expect(second.rejection.code).toBe('limit_reached')
  })

  it('lock-on targets an enemy ship', () => {
    const state = activePhaseState()
    const result = reduceCommand(
      state,
      { type: 'tactic', actorId: 'player', battleGroupId: 'player-group', tactic: 'lock-on', target: { groupId: 'enemy-group', shipId: 'e-flag' } },
      createSeededRng(7n),
    )
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    const target = result.state.battleGroups.find((g) => g.id === 'enemy-group')!
    expect(target.statusEffects.some((e) => e.kind === 'locked' && e.target === 'e-flag')).toBe(true)
  })
})

describe('action budget', () => {
  it('allows 1 maneuver + 1 tactic but rejects a third action', () => {
    let state = activePhaseState()
    const m = reduceCommand(
      state,
      { type: 'maneuver', actorId: 'player', battleGroupId: 'player-group', maneuver: 'full-thrust' },
      createSeededRng(8n),
    )
    expect(m.kind).toBe('accepted')
    if (m.kind !== 'accepted') return
    state = m.state
    const t = reduceCommand(
      state,
      { type: 'tactic', actorId: 'player', battleGroupId: 'player-group', tactic: 'careful-fire' },
      createSeededRng(9n),
    )
    expect(t.kind).toBe('accepted')
    if (t.kind !== 'accepted') return
    state = t.state
    const third = reduceCommand(
      state,
      { type: 'tactic', actorId: 'player', battleGroupId: 'player-group', tactic: 'careful-fire' },
      createSeededRng(10n),
    )
    expect(third.kind).toBe('rejected')
    if (third.kind !== 'rejected') return
    expect(third.rejection.code).toBe('command_invalid')
  })

  it('end-turn hands the turn to the enemy group', () => {
    const state = activePhaseState()
    const result = reduceCommand(state, { type: 'end-turn', actorId: 'player', battleGroupId: 'player-group' })
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    expect(result.state.activeGroupId).toBe('enemy-group')
  })
})

describe('retreat / surrender', () => {
  function logisticsState(): BattleState {
    const started = startEngagement(BATTLE_SANDBOX_V1, 'test-engagement')
    if (started.kind !== 'accepted') throw new Error('sandbox must start')
    return started.state
  }

  it('rejects retreat before critical point (round < 5)', () => {
    const state = logisticsState()
    const result = reduceCommand(state, { type: 'declare-retreat', actorId: 'player', battleGroupId: 'player-group' })
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('critical_not_reached')
  })

  it('accepts surrender in any round', () => {
    const state = logisticsState()
    const result = reduceCommand(state, { type: 'declare-surrender', actorId: 'enemy', battleGroupId: 'enemy-group' })
    expect(result.kind).toBe('accepted')
  })
})

describe('deterministic replay', () => {
  const steps = fullRoundSteps()

  it('reproduces identical state and events for the same seed', () => {
    const a = seededRun(0xabcdefn, steps)
    const b = seededRun(0xabcdefn, steps)
    expect(a.state).toEqual(b.state)
    expect(a.events).toEqual(b.events)
  })

  it('differs with a different seed', () => {
    const attackSteps: BattleCommand[] = [
      { type: 'advance-phase', actorId: 'player' },
      { type: 'advance-phase', actorId: 'player' },
      {
        type: 'maneuver',
        actorId: 'player',
        battleGroupId: 'player-group',
        maneuver: 'full-thrust',
        attacks: [{ weaponId: 'p-flag-main', target: { groupId: 'enemy-group', shipId: 'e-flag' } }],
      },
    ]
    const a = seededRun(0x1111n, attackSteps)
    const b = seededRun(0x2222n, attackSteps)
    expect(a.state).not.toEqual(b.state)
  })

  it('consumes a fixed number of RNG draws per accepted attack regardless of outcome', () => {
    const attackSteps: BattleCommand[] = [
      { type: 'advance-phase', actorId: 'player' },
      { type: 'advance-phase', actorId: 'player' },
      {
        type: 'maneuver',
        actorId: 'player',
        battleGroupId: 'player-group',
        maneuver: 'full-thrust',
        attacks: [{ weaponId: 'p-flag-main', target: { groupId: 'enemy-group', shipId: 'e-flag' } }],
      },
    ]
    // p-flag-main: 1d20 + 1 准度（0/1 带） + 0 难度 + 2d6 伤害 = 固定 4 次。
    const a = seededRun(0xaaa1n, attackSteps)
    const b = seededRun(0xaaa2n, attackSteps)
    expect(a.state.rngIndex).toBe(b.state.rngIndex)
    // 若命中了会投伤害骰，未命中也投——因此两局消费数必然相同。
    const consumedByAttack = a.events.filter((e) => e.type === 'attack-resolved')
    expect(consumedByAttack.length).toBe(1)
  })
})

describe('engagement result', () => {
  it('resolves after enemy elimination', () => {
    const started = startEngagement(BATTLE_SANDBOX_V1, 'test-engagement')
    if (started.kind !== 'accepted') throw new Error('sandbox must start')
    let state = started.state
    const rng = createSeededRng(0xbadn)
    const enemy = state.battleGroups.find((g) => g.id === 'enemy-group')!
    for (const ship of [enemy.flagship, ...enemy.ships]) {
      ship.hp = 0
      ship.status = 'destroyed'
    }
    state = markEliminatedGroups(state)
    const result = reduceCommand(state, { type: 'resolve-engagement', actorId: 'player' }, rng)
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    expect(result.state.phase).toBe('completed')
    expect(result.state.outcome).not.toBeNull()
  })

  it('yields decisive-victory when the enemy fleet is fully eliminated', () => {
    const started = startEngagement(BATTLE_SANDBOX_V1, 'test-engagement')
    if (started.kind !== 'accepted') throw new Error('sandbox must start')
    const state = markEliminatedGroups({
      ...started.state,
      battleGroups: started.state.battleGroups.map((g) =>
        g.faction === 'enemy'
          ? {
              ...g,
              flagship: { ...g.flagship, hp: 0, status: 'destroyed' as const },
              ships: g.ships.map((s) => ({ ...s, hp: 0, status: 'destroyed' as const })),
            }
          : g,
      ),
    })
    const { outcome, survivorsRatio } = computeOutcome(state)
    expect(outcome).toBe('decisive-victory')
    expect(survivorsRatio).toBe(1)
  })

  it('rejects resolve-engagement while both sides are active', () => {
    const state = activePhaseState()
    const result = reduceCommand(state, { type: 'resolve-engagement', actorId: 'player' })
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('command_invalid')
  })
})

describe('counters and ballistics', () => {
  function ballisticsState(): BattleState {
    const started = startEngagement(BATTLE_SANDBOX_V1, 'test-engagement')
    if (started.kind !== 'accepted') throw new Error('sandbox must start')
    let state = started.state
    const rng = createSeededRng(0xc0den)
    for (const step of [{ type: 'advance-phase', actorId: 'player' }] as BattleCommand[]) {
      const result = reduceCommand(state, step, rng)
      if (result.kind !== 'accepted') throw new Error('advance to ballistics failed')
      state = result.state
    }
    return state
  }

  it('decrements charge counters each logistics', () => {
    const state = ballisticsState()
    const player = state.battleGroups.find((g) => g.id === 'player-group')!
    const charged = player.flagship.weapons.find((w) => w.weaponId === 'p-flag-charge')!
    expect(charged.charge).toBe(1)
  })

  it('cannot fire a charged weapon before its counter reaches 0', () => {
    const state = ballisticsState()
    const result = reduceCommand(
      state,
      { type: 'fire-charged', actorId: 'player', battleGroupId: 'player-group', weaponId: 'p-flag-charge', target: { groupId: 'enemy-group', shipId: 'e-flag' } },
      createSeededRng(1n),
    )
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('command_invalid')
  })

  it('charged weapon resets its counter to chargeMax after firing', () => {
    // 从初始后勤阶段开始：第一轮后勤→弹着（charge 2→1）；第二轮→0，弹着开火后重置为 2。
    const started = startEngagement(BATTLE_SANDBOX_V1, 'test-engagement')
    if (started.kind !== 'accepted') throw new Error('sandbox must start')
    let state = started.state
    const rng = createSeededRng(0xabcdn)
    const advancePhases = (count: number) => {
      for (let i = 0; i < count; i++) {
        const result = reduceCommand(state, { type: 'advance-phase', actorId: 'player' }, rng)
        if (result.kind !== 'accepted') throw new Error(`advance-phase rejected: ${result.rejection.code}`)
        state = result.state
      }
    }
    const endAllTurns = () => {
      for (const id of ['player-group', 'enemy-group'] as const) {
        const result = reduceCommand(state, { type: 'end-turn', actorId: id === 'player-group' ? 'player' : 'enemy', battleGroupId: id })
        if (result.kind !== 'accepted') throw new Error('end-turn rejected')
        state = result.state
      }
    }
    // 第一轮：后勤→弹着（charge 2→1）
    advancePhases(1)
    let player = state.battleGroups.find((g) => g.id === 'player-group')!
    expect(player.flagship.weapons.find((w) => w.weaponId === 'p-flag-charge')!.charge).toBe(1)
    // 第一轮：弹着→行动，结束回合，接舷→后勤（第 2 轮）→弹着（charge 1→0）
    advancePhases(1)
    endAllTurns()
    advancePhases(3)
    player = state.battleGroups.find((g) => g.id === 'player-group')!
    expect(player.flagship.weapons.find((w) => w.weaponId === 'p-flag-charge')!.charge).toBe(0)
    const fire = reduceCommand(
      state,
      { type: 'fire-charged', actorId: 'player', battleGroupId: 'player-group', weaponId: 'p-flag-charge', target: { groupId: 'enemy-group', shipId: 'e-flag' } },
      createSeededRng(0xbeefn),
    )
    expect(fire.kind).toBe('accepted')
    if (fire.kind !== 'accepted') return
    player = fire.state.battleGroups.find((g) => g.id === 'player-group')!
    expect(player.flagship.weapons.find((w) => w.weaponId === 'p-flag-charge')!.charge).toBe(2)
  })

  it('payload weapon gains flight counter on launch and auto-hits at 0', () => {
    let state = activePhaseState()
    const events: import('./types').BattleEvent[] = []
    // 玩家先结束回合，敌方在行动阶段发射酬载（敌人距离带 3 → 飞行计数 3）。
    const playerEnd = reduceCommand(state, { type: 'end-turn', actorId: 'player', battleGroupId: 'player-group' })
    if (playerEnd.kind !== 'accepted') throw new Error('player end-turn failed')
    state = playerEnd.state
    const launch = reduceCommand(
      state,
      {
        type: 'maneuver',
        actorId: 'enemy',
        battleGroupId: 'enemy-group',
        maneuver: 'full-thrust',
        attacks: [{ weaponId: 'e-flag-payload', target: { groupId: 'player-group', shipId: 'p-flag' } }],
      },
      createSeededRng(0xfe0n),
    )
    expect(launch.kind).toBe('accepted')
    if (launch.kind !== 'accepted') return
    state = launch.state
    events.push(...launch.events)
    const enemy = state.battleGroups.find((g) => g.id === 'enemy-group')!
    const payload = enemy.flagship.weapons.find((w) => w.weaponId === 'e-flag-payload')!
    // full-thrust 前进 1 → 距离带 2，酬载飞行计数 2。
    expect(payload.flight).toBe(2)

    // 敌方本回合已发射，先结束其回合；随后每轮推进直到飞行计数到 0 并结算。
    const rng = createSeededRng(0xfe1n)
    const enemyEnd = reduceCommand(state, { type: 'end-turn', actorId: 'enemy', battleGroupId: 'enemy-group' })
    if (enemyEnd.kind !== 'accepted') throw new Error('enemy end-turn failed')
    state = enemyEnd.state
    let guard = 0
    while (guard < 12) {
      guard += 1
      for (const step of [
        { type: 'advance-phase', actorId: 'player' },
        { type: 'advance-phase', actorId: 'player' },
        { type: 'advance-phase', actorId: 'player' },
        { type: 'advance-phase', actorId: 'player' },
        { type: 'end-turn', actorId: 'player', battleGroupId: 'player-group' },
        { type: 'end-turn', actorId: 'enemy', battleGroupId: 'enemy-group' },
      ] as BattleCommand[]) {
        const result = reduceCommand(state, step, rng)
        if (result.kind !== 'accepted') throw new Error(`step ${step.type} rejected: ${result.rejection.code}`)
        state = result.state
        events.push(...result.events)
      }
      const enemy = state.battleGroups.find((g) => g.id === 'enemy-group')!
      const payload = enemy.flagship.weapons.find((w) => w.weaponId === 'e-flag-payload')!
      if (payload.flight === 0 || payload.flight === null) break
    }
    // 弹着结算触发阻滞骰（说明酬载已自动命中）。
    const blockEvent = events.find((e): e is import('./types').BlockRolledEvent =>
      e.type === 'block-rolled' && e.battleGroupId === 'player-group',
    )
    expect(blockEvent).toBeDefined()
    expect(blockEvent!.roll).toBeGreaterThanOrEqual(1)
  })
})
