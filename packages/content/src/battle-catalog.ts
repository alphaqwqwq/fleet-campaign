import type { BattleShipTemplate, BattleWeaponTemplate } from './battle-types'

/**
 * 精选目录（M2-B 内容，全自创抽象名，R-004）。
 * 船体点数为"基底"；旗舰在构筑器里补 +3HP/+1 阻滞骰/+1 系统槽（v1 记于构筑层）。
 */

export const CATALOG_WEAPONS: readonly BattleWeaponTemplate[] = [
  // 副武器（近程点防）
  { id: 'w-sweep', size: 'secondary', damage: '1d6', range: 2, points: 0 },
  { id: 'w-hail', size: 'secondary', damage: '2', range: 1, points: 0 },
  // 主武器
  { id: 'w-spike', size: 'main', damage: '2d6', range: 5, crit: true, points: 1 },
  { id: 'w-grapple', size: 'main', damage: '1d6+2', range: 4, payload: 3, area: true, points: 1 },
  // 超重型
  { id: 'w-bolt', size: 'superheavy', damage: '3d6', range: 4, charge: 2, crit: true, points: 2 },
  { id: 'w-typhoon', size: 'superheavy', damage: '2d6+2', range: 3, area: true, crit: true, points: 2 },
  { id: 'w-gauntlet', size: 'superheavy', damage: '2d6', range: 1, area: true, points: 1 },
]

export const CATALOG_HULLS: readonly BattleShipTemplate[] = [
  // 巡防舰（轻护）
  { id: 'h-dart', type: 'frigate', hp: 6, defense: 13, blockBonus: 1, weapons: [], points: 2 },
  { id: 'h-arrow', type: 'frigate', hp: 7, defense: 12, blockBonus: 1, weapons: [], points: 3 },
  // 航母
  { id: 'h-hive', type: 'carrier', hp: 10, defense: 11, blockBonus: 0, weapons: [], points: 5 },
  { id: 'h-forge', type: 'carrier', hp: 11, defense: 10, blockBonus: 1, weapons: [], points: 6 },
  // 战列舰
  { id: 'h-bulwark', type: 'battleship', hp: 12, defense: 12, blockBonus: 0, weapons: [], points: 7 },
  { id: 'h-reaver', type: 'battleship', hp: 14, defense: 10, blockBonus: 1, weapons: [], points: 8 },
]

/** 构筑预算：每战斗群 20 点。 */
export const POINT_BUDGET = 20

/** 每战斗群舰型上限（原作 P61 简化）：巡防 ≤3、航母 ≤2、战列 ≤1。 */
export const HULL_LIMITS: Record<BattleShipTemplate['type'], number> = {
  frigate: 3,
  carrier: 2,
  battleship: 1,
}
