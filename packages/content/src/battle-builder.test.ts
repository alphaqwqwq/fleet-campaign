import { describe, expect, it } from 'vitest'

import { buildBattleContent, POINT_BUDGET, shipPoints, validateBattleContent, type BattleGroupBuild } from './index'

function playerBuild(): BattleGroupBuild {
  return {
    id: 'player-group',
    faction: 'player',
    startingDistance: 3,
    ships: [
      { hullId: 'h-bulwark', flag: true, weaponIds: ['w-spike', 'w-bolt'] },
      { hullId: 'h-dart', weaponIds: ['w-sweep'] },
    ],
  }
}

function enemyBuild(): BattleGroupBuild {
  return {
    id: 'enemy-group',
    faction: 'enemy',
    startingDistance: 3,
    ships: [
      { hullId: 'h-hive', flag: true, weaponIds: ['w-grapple', 'w-sweep'] },
      { hullId: 'h-arrow', weaponIds: ['w-spike'] },
    ],
  }
}

describe('buildBattleContent', () => {
  it('builds a valid two-group battle within budget', () => {
    const result = buildBattleContent('battle-catalog-test', [playerBuild(), enemyBuild()])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.battleGroups).toHaveLength(2)
    const player = result.value.battleGroups.find((g) => g.id === 'player-group')!
    expect(player.flagship.flag).toBe(true)
    // 旗舰加成由引擎施加：模板保持船体基底 hp；+3 在 createInitialBattle 依据 flag 应用。
    expect(player.flagship.hp).toBe(12)
    expect(player.flagship.blockBonus).toBe(1)
    expect(player.ships).toHaveLength(1)
  })

  it('rejects when no flagship is designated', () => {
    const result = buildBattleContent('x', [
      {
        ...playerBuild(),
        ships: [{ hullId: 'h-bulwark', weaponIds: ['w-spike'] }, { hullId: 'h-dart', weaponIds: [] }],
      },
      enemyBuild(),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join()).toContain('exactly one flagship')
  })

  it('rejects an unknown hull id', () => {
    const result = buildBattleContent('x', [
      { ...playerBuild(), ships: [{ hullId: 'h-missing', flag: true, weaponIds: [] }, { hullId: 'h-dart', weaponIds: [] }] },
      enemyBuild(),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join()).toContain('unknown hull')
  })

  it('rejects a group that exceeds the point budget', () => {
    const result = buildBattleContent('x', [
      {
        id: 'player-group',
        faction: 'player',
        startingDistance: 3,
        ships: [
          { hullId: 'h-reaver', flag: true, weaponIds: ['w-bolt', 'w-typhoon'] },
          { hullId: 'h-reaver', weaponIds: ['w-bolt'] },
          { hullId: 'h-reaver', weaponIds: ['w-bolt'] },
        ],
      },
      enemyBuild(),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join()).toContain('exceeding budget')
  })

  it('rejects exceeding hull-type limits', () => {
    const result = buildBattleContent('x', [
      {
        ...playerBuild(),
        ships: [
          { hullId: 'h-bulwark', flag: true, weaponIds: [] },
          { hullId: 'h-bulwark', weaponIds: [] },
        ],
      },
      enemyBuild(),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join()).toContain('battleship limit')
  })

  it('rejects fewer than 2 capital ships', () => {
    const result = buildBattleContent('x', [
      { ...playerBuild(), ships: [{ hullId: 'h-bulwark', flag: true, weaponIds: [] }] },
      enemyBuild(),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join()).toContain('at least 2 capital ships')
  })

  it('mints unique instance ids so duplicate hulls pass content validation', () => {
    const result = buildBattleContent('x', [
      {
        id: 'player-group',
        faction: 'player',
        startingDistance: 3,
        ships: [
          { hullId: 'h-hive', flag: true, weaponIds: ['w-grapple'] },
          { hullId: 'h-hive', weaponIds: ['w-sweep'] },
        ],
      },
      enemyBuild(),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const validation = validateBattleContent(result.value)
    expect(validation.ok).toBe(true)
    const player = result.value.battleGroups[0]
    expect(player.flagship.id).toBe('h-hive-1')
    expect(player.ships.map((s) => s.id)).toEqual(['h-hive-2'])
  })
})

describe('points accounting', () => {
  it('sums hull and weapon points', () => {
    const bulwark = { id: 'h-bulwark', type: 'battleship' as const, hp: 12, defense: 12, weapons: [], points: 7 }
    expect(shipPoints(bulwark, ['w-spike', 'w-bolt'])).toBe(7 + 1 + 2)
  })

  it('keeps the budget constant at 20', () => {
    expect(POINT_BUDGET).toBe(20)
  })
})
