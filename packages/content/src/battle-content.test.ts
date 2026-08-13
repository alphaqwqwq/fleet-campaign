import { describe, expect, it } from 'vitest'

import { BATTLE_SANDBOX_V1, validateBattleContent } from './index'

describe('BATTLE_SANDBOX_V1', () => {
  it('is a valid battle content fixture', () => {
    const result = validateBattleContent(BATTLE_SANDBOX_V1)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.kind).toBe('battle-v1')
      expect(result.value.battleGroups).toHaveLength(2)
    }
  })
})

describe('validateBattleContent', () => {
  it('accepts a valid battle template', () => {
    expect(validateBattleContent(BATTLE_SANDBOX_V1).ok).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(validateBattleContent(null).ok).toBe(false)
    expect(validateBattleContent([]).ok).toBe(false)
    expect(validateBattleContent('battle').ok).toBe(false)
  })

  it('rejects an unknown kind', () => {
    const result = validateBattleContent({ ...BATTLE_SANDBOX_V1, kind: 'legacy' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('kind')
  })

  it('rejects empty battleGroups', () => {
    const result = validateBattleContent({ ...BATTLE_SANDBOX_V1, battleGroups: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('battleGroups')
  })

  it('rejects an out-of-range startingDistance', () => {
    const result = validateBattleContent({
      ...BATTLE_SANDBOX_V1,
      battleGroups: BATTLE_SANDBOX_V1.battleGroups.map((group, index) =>
        index === 0 ? { ...group, startingDistance: 9 } : group,
      ),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('startingDistance')
  })

  it('rejects a flagship without flag: true', () => {
    const result = validateBattleContent({
      ...BATTLE_SANDBOX_V1,
      battleGroups: BATTLE_SANDBOX_V1.battleGroups.map((group, index) =>
        index === 0 ? { ...group, flagship: { ...group.flagship, flag: false } } : group,
      ),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('flag')
  })

  it('rejects a malformed damage expression', () => {
    const result = validateBattleContent({
      ...BATTLE_SANDBOX_V1,
      battleGroups: BATTLE_SANDBOX_V1.battleGroups.map((group, index) =>
        index === 0
          ? {
              ...group,
              flagship: {
                ...group.flagship,
                weapons: group.flagship.weapons.map((weapon, wi) =>
                  wi === 0 ? { ...weapon, damage: '1d6d6' } : weapon,
                ),
              },
            }
          : group,
      ),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('damage')
  })
})
