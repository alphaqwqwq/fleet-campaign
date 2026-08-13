export const BATTLE_CONTENT_KIND = 'battle-v1' as const

export type BattleFaction = 'player' | 'enemy'

export type HullType = 'frigate' | 'carrier' | 'battleship'

export type WeaponSize = 'secondary' | 'main' | 'superheavy'

export interface BattleWeaponTemplate {
  id: string
  size: WeaponSize
  /** 伤害表达式，如 "2d6"、"4"、"1d6+2"。 */
  damage: string
  /** 距离上限（环带 0..5）内可用；缺省为所有距离。 */
  range?: number
  /** 充能计数：充电完成后（0）在弹着阶段开火。 */
  charge?: number
  /** 酬载飞行计数：发射时置为该值，每轮后勤 -1，0 时在弹着阶段命中。 */
  payload?: number
  /** 装填计数：使用后每轮后勤 -1，0 时可再用。 */
  reload?: number
  /** 区域伤害：伤害作用于战斗群全部船舰；阻滞骰可减免。 */
  area?: boolean
  /** 会心标签：命中骰 20+ 时伤害翻倍。 */
  crit?: boolean
  /** 构筑点数（point-buy 消耗）；缺省 0。引擎不消费。 */
  points?: number
}

export interface BattleShipTemplate {
  id: string
  type: HullType
  hp: number
  defense: number
  weapons: BattleWeaponTemplate[]
  /** 阻滞加成（d6 枚数）；战斗群级阻滞骰 = 全舰块数 + 旗舰 1。 */
  blockBonus?: number
  /** 旗舰：+3 HP / +1 阻滞骰 / +1 系统槽（v1 简化记于内容）。 */
  flag?: boolean
  /** 构筑点数（point-buy 消耗）。引擎不消费。 */
  points?: number
}

export interface BattleGroupTemplate {
  id: string
  faction: BattleFaction
  flagship: BattleShipTemplate
  ships: BattleShipTemplate[]
  /** 起始距离带 0..5。 */
  startingDistance: number
}

export interface BattleContent {
  contentId: string
  kind: typeof BATTLE_CONTENT_KIND
  battleGroups: BattleGroupTemplate[]
}

export type BattleContentId = string
