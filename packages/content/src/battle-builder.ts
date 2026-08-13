import { BATTLE_CONTENT_KIND, type BattleContent, type BattleFaction, type BattleGroupTemplate, type BattleShipTemplate } from './battle-types'
import { CATALOG_HULLS, CATALOG_WEAPONS, HULL_LIMITS, POINT_BUDGET } from './battle-catalog'

/** 单舰装载：选船体 + 若干武器（目录 id）。 */
export interface ShipLoadout {
  hullId: string
  weaponIds: string[]
  /** 该舰是否旗舰（每战斗群恰好一艘）。 */
  flag?: boolean
}

export interface BattleGroupBuild {
  id: string
  faction: BattleFaction
  startingDistance: number
  ships: ShipLoadout[]
}

export type BuildResult =
  | { ok: true; value: BattleContent; points: number }
  | { ok: false; errors: string[] }

function hullById(id: string): BattleShipTemplate | undefined {
  return CATALOG_HULLS.find((hull) => hull.id === id)
}

/** 计算舰体 + 武器的构筑点数（旗舰加成不加点）。 */
export function shipPoints(hull: BattleShipTemplate, weaponIds: string[]): number {
  const weaponPoints = weaponIds.reduce((sum, id) => {
    const weapon = CATALOG_WEAPONS.find((w) => w.id === id)
    return sum + (weapon?.points ?? 0)
  }, 0)
  return (hull.points ?? 0) + weaponPoints
}

function buildGroupShips(build: BattleGroupBuild, errors: string[]): BattleShipTemplate[] {
  const flags = build.ships.filter((s) => s.flag)
  if (flags.length !== 1) {
    errors.push(`group ${build.id} must have exactly one flagship`)
    return []
  }

  const byType: Record<BattleShipTemplate['type'], number> = { frigate: 0, carrier: 0, battleship: 0 }
  const ships: BattleShipTemplate[] = []
  for (const loadout of build.ships) {
    const hull = hullById(loadout.hullId)
    if (!hull) {
      errors.push(`group ${build.id}: unknown hull "${loadout.hullId}"`)
      continue
    }
    const weapons = loadout.weaponIds.map((id) => {
      const weapon = CATALOG_WEAPONS.find((w) => w.id === id)
      if (!weapon) errors.push(`group ${build.id}: unknown weapon "${id}"`)
      return weapon
    })
    const validWeapons = weapons.filter((w): w is NonNullable<typeof w> => w !== undefined)
    byType[hull.type] += 1
    if (byType[hull.type] > HULL_LIMITS[hull.type]) {
      errors.push(`group ${build.id}: exceeds ${hull.type} limit of ${HULL_LIMITS[hull.type]}`)
    }
    // 实例 id：同一船体可多次选取，须唯一（引擎按 id 定位舰船）。
    const instanceId = `${hull.id}-${byType[hull.type]}`
    ships.push({
      ...hull,
      id: instanceId,
      weapons: validWeapons,
      flag: loadout.flag ?? false,
      // 旗舰加成：+1 阻滞骰 / +1 系统槽（HP 由引擎 buildShip 依据 flag 施加）。
      blockBonus: (hull.blockBonus ?? 0) + (loadout.flag ? 1 : 0),
    })
  }
  return ships
}

function groupPoints(ships: BattleShipTemplate[]): number {
  return ships.reduce((sum, ship) => sum + shipPoints(ship, ship.weapons.map((w) => w.id)), 0)
}

/**
 * 20 点构筑器：目录内选船体/武器，产出可被引擎消费的 BattleContent。
 * 校验：恰好 1 旗舰、≥2 主力舰、每舰型不超过上限、总点数 ≤20。
 */
export function buildBattleContent(contentId: string, groups: BattleGroupBuild[]): BuildResult {
  const errors: string[] = []
  const builtGroups: BattleGroupTemplate[] = []
  let totalPoints = 0

  for (const build of groups) {
    const ships = buildGroupShips(build, errors)
    if (ships.length === 0) continue
    if (ships.length < 2) errors.push(`group ${build.id} must contain at least 2 capital ships`)
    const points = groupPoints(ships)
    totalPoints += points
    if (points > POINT_BUDGET) errors.push(`group ${build.id} costs ${points} points, exceeding budget ${POINT_BUDGET}`)
    builtGroups.push({
      id: build.id,
      faction: build.faction,
      flagship: ships.find((s) => s.flag)!,
      ships: ships.filter((s) => !s.flag),
      startingDistance: build.startingDistance,
    })
  }

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: { contentId, kind: BATTLE_CONTENT_KIND, battleGroups: builtGroups },
    points: totalPoints,
  }
}
