import { BATTLE_CONTENT_KIND, type BattleContent } from './battle-types'

export type BattleContentValidation =
  | { ok: true; value: BattleContent }
  | { ok: false; errors: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const DAMAGE_RE = /^(\d+)$|^(\d+)d(\d+)(\+\d+)?$/

/** 校验交战内容 schema（无运行时依赖）；违规返回确定性错误列表。 */
export function validateBattleContent(input: unknown): BattleContentValidation {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['battle content must be an object'] }
  if (input.kind !== BATTLE_CONTENT_KIND) {
    errors.push(`kind must be "${BATTLE_CONTENT_KIND}"`)
  }
  if (typeof input.contentId !== 'string' || input.contentId.length === 0) {
    errors.push('contentId must be a non-empty string')
  }
  if (!Array.isArray(input.battleGroups)) {
    errors.push('battleGroups must be an array')
  } else if (input.battleGroups.length === 0) {
    errors.push('battleGroups must contain at least one battle group')
  } else {
    const ids = new Set<string>()
    input.battleGroups.forEach((group, gi) => {
      if (!isRecord(group)) {
        errors.push(`battleGroups[${gi}] must be an object`)
        return
      }
      if (typeof group.id !== 'string' || group.id.length === 0) {
        errors.push(`battleGroups[${gi}].id must be a non-empty string`)
      } else if (ids.has(group.id)) {
        errors.push(`battleGroups[${gi}].id is duplicated`)
      } else {
        ids.add(group.id)
      }
      if (group.faction !== 'player' && group.faction !== 'enemy') {
        errors.push(`battleGroups[${gi}].faction must be player or enemy`)
      }
      const distance = group.startingDistance
      if (typeof distance !== 'number' || !Number.isInteger(distance) || distance < 0 || distance > 5) {
        errors.push(`battleGroups[${gi}].startingDistance must be an integer 0..5`)
      }
      validateShip(group.flagship, `battleGroups[${gi}].flagship`, errors)
      if (group.flagship && isRecord(group.flagship) && !group.flagship.flag) {
        errors.push(`battleGroups[${gi}].flagship must have flag: true`)
      }
      if (!Array.isArray(group.ships)) {
        errors.push(`battleGroups[${gi}].ships must be an array`)
      } else {
        const shipIds = new Set<string>()
        if (group.flagship && isRecord(group.flagship) && typeof group.flagship.id === 'string') {
          shipIds.add(group.flagship.id)
        }
        group.ships.forEach((ship, si) => {
          validateShip(ship, `battleGroups[${gi}].ships[${si}]`, errors)
          if (ship && isRecord(ship) && typeof ship.id === 'string') {
            if (shipIds.has(ship.id)) errors.push(`battleGroups[${gi}].ships[${si}].id is duplicated`)
            shipIds.add(ship.id)
          }
        })
      }
    })
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: input as unknown as BattleContent }
}

function validateShip(input: unknown, path: string, errors: string[]): void {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`)
    return
  }
  if (typeof input.id !== 'string' || input.id.length === 0) errors.push(`${path}.id must be a non-empty string`)
  if (input.type !== 'frigate' && input.type !== 'carrier' && input.type !== 'battleship') {
    errors.push(`${path}.type must be frigate, carrier or battleship`)
  }
  if (typeof input.hp !== 'number' || !Number.isInteger(input.hp) || input.hp < 1) {
    errors.push(`${path}.hp must be a positive integer`)
  }
      if (typeof input.defense !== 'number' || !Number.isInteger(input.defense) || input.defense < 6 || input.defense > 20) {
        errors.push(`${path}.defense must be an integer 6..20`)
      }
  if (!Array.isArray(input.weapons)) {
    errors.push(`${path}.weapons must be an array`)
  } else {
    const weaponIds = new Set<string>()
    input.weapons.forEach((weapon, wi) => {
      if (!isRecord(weapon)) {
        errors.push(`${path}.weapons[${wi}] must be an object`)
        return
      }
      if (typeof weapon.id !== 'string' || weapon.id.length === 0) {
        errors.push(`${path}.weapons[${wi}].id must be a non-empty string`)
      } else if (weaponIds.has(weapon.id)) {
        errors.push(`${path}.weapons[${wi}].id is duplicated`)
      } else {
        weaponIds.add(weapon.id)
      }
      if (weapon.size !== 'secondary' && weapon.size !== 'main' && weapon.size !== 'superheavy') {
        errors.push(`${path}.weapons[${wi}].size must be secondary, main or superheavy`)
      }
      if (typeof weapon.damage !== 'string' || !DAMAGE_RE.test(weapon.damage)) {
        errors.push(`${path}.weapons[${wi}].damage must match <n> or <n>d<n>[+<n>]`)
      }
      if (weapon.range !== undefined && (typeof weapon.range !== 'number' || !Number.isInteger(weapon.range) || weapon.range < 0 || weapon.range > 5)) {
        errors.push(`${path}.weapons[${wi}].range must be an integer 0..5`)
      }
      if (weapon.charge !== undefined && weapon.payload !== undefined) {
        errors.push(`${path}.weapons[${wi}] cannot be both charged and payload`)
      }
      for (const counter of ['charge', 'payload', 'reload'] as const) {
        const value = weapon[counter]
        if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value) || value < 1)) {
          errors.push(`${path}.weapons[${wi}].${counter} must be a positive integer`)
        }
      }
      if (weapon.area !== undefined && typeof weapon.area !== 'boolean') {
        errors.push(`${path}.weapons[${wi}].area must be a boolean`)
      }
      if (weapon.crit !== undefined && typeof weapon.crit !== 'boolean') {
        errors.push(`${path}.weapons[${wi}].crit must be a boolean`)
      }
    })
  }
  if (input.blockBonus !== undefined && (typeof input.blockBonus !== 'number' || !Number.isInteger(input.blockBonus) || input.blockBonus < 0)) {
    errors.push(`${path}.blockBonus must be a non-negative integer`)
  }
  if (input.flag !== undefined && typeof input.flag !== 'boolean') {
    errors.push(`${path}.flag must be a boolean`)
  }
}
