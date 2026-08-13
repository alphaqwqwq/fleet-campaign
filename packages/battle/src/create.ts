import { BATTLE_CONTENT_KIND, validateBattleContent, type BattleContent, type BattleShipTemplate } from '@fleet-campaign/content'

import type { BattleGroupState, BattleShipState, BattleState, BattleWeaponState } from './types'

export type CreateEngagementResult =
  | { ok: true; state: BattleState; engagementId: string }
  | { ok: false; errors: string[] }

let idCounter = 0

/** 引擎生成领域内唯一交战标识（不含存档/协议含义）。 */
export function generateEngagementId(): string {
  idCounter += 1
  return `battle-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

function buildWeapon(template: BattleShipTemplate['weapons'][number]): BattleWeaponState {
  return {
    weaponId: template.id,
    size: template.size,
    damage: template.damage,
    range: template.range ?? 5,
    area: template.area ?? false,
    crit: template.crit ?? false,
    charge: template.charge ?? null,
    chargeMax: template.charge ?? null,
    payload: template.payload !== undefined,
    flight: null,
    reload: template.reload ?? null,
  }
}

function buildShip(template: BattleShipTemplate): BattleShipState {
  return {
    id: template.id,
    type: template.type,
    hp: template.flag ? template.hp + 3 : template.hp,
    maxHp: template.flag ? template.hp + 3 : template.hp,
    defense: template.defense,
    flag: template.flag ?? false,
    blockBonus: template.blockBonus ?? 0,
    status: 'active',
    weapons: template.weapons.map(buildWeapon),
  }
}

/**
 * 通过显式内容输入建立交战初始状态（内容必须通过校验，失败返回确定性错误）。
 * 阻滞骰 = 旗舰 1 + 全舰 blockBonus 之和。
 */
export function createInitialBattle(content: BattleContent, engagementId?: string): CreateEngagementResult {
  const validation = validateBattleContent(content)
  if (!validation.ok) {
    return { ok: false, errors: validation.errors }
  }
  if (content.kind !== BATTLE_CONTENT_KIND) {
    return { ok: false, errors: [`content.kind must be "${BATTLE_CONTENT_KIND}"`] }
  }
  if (content.battleGroups.length < 2) {
    return { ok: false, errors: ['battle content must define at least 2 battle groups'] }
  }

  const groups: BattleGroupState[] = content.battleGroups.map((template) => {
    const flagship = buildShip(template.flagship)
    const ships = template.ships.map(buildShip)
    const blockDice = 1 + flagship.blockBonus + ships.reduce((sum, ship) => sum + ship.blockBonus, 0)
    return {
      id: template.id,
      controller: template.faction === 'player' ? 'player' : 'enemy',
      faction: template.faction,
      flagship,
      ships,
      distance: template.startingDistance,
      blockDice,
      status: 'active',
      limitedUsed: [],
      statusEffects: [],
      turnActions: { maneuvers: 0, tactics: 0 },
    }
  })

  const actionOrder = groups.map((group) => group.id)
  const state: BattleState = {
    engagementId: engagementId ?? generateEngagementId(),
    contentId: content.contentId,
    round: 1,
    phase: 'logistics',
    battleGroups: groups,
    actionOrder,
    activeGroupId: null,
    outcome: null,
    rngIndex: 0,
  }
  return { ok: true, state, engagementId: state.engagementId }
}
