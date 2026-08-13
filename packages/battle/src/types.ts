import type { BattleFaction, HullType, WeaponSize } from '@fleet-campaign/content'

export type BattlePhase = 'logistics' | 'ballistics' | 'action' | 'boarding' | 'completed'

export type BattleGroupStatus = 'active' | 'retreated' | 'surrendered' | 'eliminated'

export type ManeuverType = 'full-thrust' | 'all-guns-fire' | 'retro-thrust'

export type TacticType = 'lock-on' | 'careful-fire' | 'emergency-maneuver'

export type EngagementOutcome = 'decisive-victory' | 'strategic-victory' | 'pyrrhic-victory' | 'strategic-defeat' | 'decisive-defeat'

export type StatusEffectKind = 'locked' | 'braced' | 'careful-fire'

/**
 * 持续效果。到期规则：
 * - locked：目标舰在下一个弹着阶段开始时清除（也可被单目标攻击消耗）。
 * - braced / careful-fire：在 expiresRound（自身下一回合）之后清除。
 */
export interface StatusEffect {
  kind: StatusEffectKind
  /** locked 作用对象（目标舰 id）；其他效果为空。 */
  target?: string
  /** braced / careful-fire 的到期轮次（不含）。 */
  expiresRound?: number
}

export interface BattleWeaponState {
  weaponId: string
  size: WeaponSize
  damage: string
  range: number
  area: boolean
  crit: boolean
  /** 充能计数；非充能武器为 null。 */
  charge: number | null
  /** 充能武器开火后重设的目标值（= 内容 charge）；非充能武器为 null。 */
  chargeMax: number | null
  /** 是否为酬载武器（发射后按发射距离带设置飞行计数）。 */
  payload: boolean
  /** 飞行计数；非在飞酬载为 null。 */
  flight: number | null
  /** 装填计数；非装填武器为 null。 */
  reload: number | null
}

export interface BattleShipState {
  id: string
  type: HullType
  hp: number
  maxHp: number
  defense: number
  flag: boolean
  /** 阻滞加成（d6 枚数），战斗群级聚合用。 */
  blockBonus: number
  status: 'active' | 'destroyed' | 'disabled'
  weapons: BattleWeaponState[]
}

export interface BattleGroupState {
  id: string
  controller: string
  faction: BattleFaction
  flagship: BattleShipState
  ships: BattleShipState[]
  /** 涡流盘距离带 0..5（0=至近，5=极限）。 */
  distance: number
  /** 战斗群级阻滞骰（d6 枚数）：旗舰 1 + 全舰 blockBonus 之和。 */
  blockDice: number
  status: BattleGroupStatus
  /** 受限 1 战术/机动使用记录。 */
  limitedUsed: string[]
  statusEffects: StatusEffect[]
  /** 本回合已用行动预算（行动阶段）。 */
  turnActions: { maneuvers: number; tactics: number }
}

export interface BattleState {
  engagementId: string
  contentId: string
  round: number
  phase: BattlePhase
  battleGroups: BattleGroupState[]
  actionOrder: string[]
  activeGroupId: string | null
  outcome: EngagementOutcome | null
  rngIndex: number
}

export interface AttackTarget {
  groupId: string
  shipId: string
}

export type BattleCommand =
  | { type: 'advance-phase'; actorId: string }
  | { type: 'declare-retreat'; actorId: string; battleGroupId: string }
  | { type: 'declare-surrender'; actorId: string; battleGroupId: string }
  | {
      type: 'maneuver'
      actorId: string
      battleGroupId: string
      maneuver: ManeuverType
      attacks?: { weaponId: string; target: AttackTarget }[]
      /** retro-thrust：true=后退 1 距离；false=忽略下一次强制移动。 */
      retreat?: boolean
    }
  | {
      type: 'tactic'
      actorId: string
      battleGroupId: string
      tactic: TacticType
      target?: AttackTarget
      /** emergency-maneuver 方向。 */
      direction?: 'advance' | 'retreat'
    }
  | { type: 'fire-charged'; actorId: string; battleGroupId: string; weaponId: string; target: AttackTarget }
  | { type: 'delay-charged'; actorId: string; battleGroupId: string; weaponId: string }
  | { type: 'end-turn'; actorId: string; battleGroupId: string }
  | { type: 'resolve-engagement'; actorId: string }

export interface BaseBattleEvent {
  rngIndex: number
}

export interface EngagementStartedEvent extends BaseBattleEvent {
  type: 'engagement-started'
  engagementId: string
  contentId: string
  round: number
  battleGroups: { id: string; faction: BattleFaction; distance: number; ships: string[] }[]
}

export interface RoundStartedEvent extends BaseBattleEvent {
  type: 'round-started'
  round: number
  phase: BattlePhase
}

export interface PhaseAdvancedEvent extends BaseBattleEvent {
  type: 'phase-advanced'
  from: BattlePhase
  to: BattlePhase
}

export interface TurnAdvancedEvent extends BaseBattleEvent {
  type: 'turn-advanced'
  fromGroupId: string
  toGroupId: string | null
}

export interface CounterTickEvent extends BaseBattleEvent {
  type: 'counter-tick'
  battleGroupId: string
  weaponId: string
  charge: number | null
  flight: number | null
  reload: number | null
}

export interface ChargedFiredEvent extends BaseBattleEvent {
  type: 'charged-fired'
  battleGroupId: string
  weaponId: string
  target: AttackTarget
}

export interface ChargedDelayedEvent extends BaseBattleEvent {
  type: 'charged-delayed'
  battleGroupId: string
  weaponId: string
}

export interface AttackResolvedEvent extends BaseBattleEvent {
  type: 'attack-resolved'
  attackerGroupId: string
  weaponId: string
  targetShipId: string
  roll: number
  accuracyBonus: number
  difficultyPenalty: number
  total: number
  defense: number
  hit: boolean
  crit: boolean
}

export interface DamageAppliedEvent extends BaseBattleEvent {
  type: 'damage-applied'
  targetGroupId: string
  targetShipId: string
  gross: number
  blocked: number
  net: number
  destroyed?: boolean
  disabled?: boolean
}

export interface BlockRolledEvent extends BaseBattleEvent {
  type: 'block-rolled'
  battleGroupId: string
  blockDice: number
  roll: number
}

export interface ManeuverPerformedEvent extends BaseBattleEvent {
  type: 'maneuver-performed'
  battleGroupId: string
  maneuver: ManeuverType
  distanceBefore: number
  distanceAfter: number
}

export interface TacticPerformedEvent extends BaseBattleEvent {
  type: 'tactic-performed'
  battleGroupId: string
  tactic: TacticType
  target?: AttackTarget
}

export interface StatusAppliedEvent extends BaseBattleEvent {
  type: 'status-applied'
  battleGroupId: string
  status: StatusEffectKind
  target?: string
}

export interface StatusExpiredEvent extends BaseBattleEvent {
  type: 'status-expired'
  battleGroupId: string
  status: StatusEffectKind
}

export interface RetreatDeclaredEvent extends BaseBattleEvent {
  type: 'retreat-declared'
  battleGroupId: string
}

export interface SurrenderDeclaredEvent extends BaseBattleEvent {
  type: 'surrender-declared'
  battleGroupId: string
}

export interface ShipDestroyedEvent extends BaseBattleEvent {
  type: 'ship-destroyed'
  battleGroupId: string
  shipId: string
}

export interface ShipDisabledEvent extends BaseBattleEvent {
  type: 'ship-disabled'
  battleGroupId: string
  shipId: string
}

export interface EngagementCompletedEvent extends BaseBattleEvent {
  type: 'engagement-completed'
  outcome: EngagementOutcome
  survivorsRatio: number
  battleGroups: { id: string; status: BattleGroupStatus; shipsRemaining: number }[]
}

export type BattleEvent =
  | EngagementStartedEvent
  | RoundStartedEvent
  | PhaseAdvancedEvent
  | TurnAdvancedEvent
  | CounterTickEvent
  | ChargedFiredEvent
  | ChargedDelayedEvent
  | AttackResolvedEvent
  | DamageAppliedEvent
  | BlockRolledEvent
  | ManeuverPerformedEvent
  | TacticPerformedEvent
  | StatusAppliedEvent
  | StatusExpiredEvent
  | RetreatDeclaredEvent
  | SurrenderDeclaredEvent
  | ShipDestroyedEvent
  | ShipDisabledEvent
  | EngagementCompletedEvent

export type BattleRejectionCode =
  | 'content_invalid'
  | 'phase_mismatch'
  | 'forbidden_controller'
  | 'not_active_group'
  | 'not_all_turns_ended'
  | 'critical_not_reached'
  | 'cannot_retreat'
  | 'limit_reached'
  | 'no_valid_target'
  | 'command_invalid'

export interface BattleRejection {
  code: BattleRejectionCode
}
