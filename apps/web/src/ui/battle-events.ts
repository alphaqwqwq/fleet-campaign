import type { BattleEvent } from '@fleet-campaign/battle'

/** 把 M2 交战领域事件投影为简短可读文本（仅 UI 展示，不影响规则）。 */
export function describeBattleEvent(event: BattleEvent): string {
  switch (event.type) {
    case 'engagement-started':
      return `交战开始 · round ${event.round}`
    case 'round-started':
      return `第 ${event.round} 轮 · 进入后勤`
    case 'phase-advanced':
      return `阶段：${event.from} → ${event.to}`
    case 'turn-advanced':
      return `行动：${event.fromGroupId} → ${event.toGroupId ?? '结束'}`
    case 'counter-tick':
      return `计数：${event.battleGroupId}/${event.weaponId} 充能${event.charge ?? '-'} 飞行${event.flight ?? '-'} 装填${event.reload ?? '-'}`
    case 'charged-fired':
      return `充能开火：${event.battleGroupId}/${event.weaponId} → ${event.target.groupId}/${event.target.shipId}`
    case 'charged-delayed':
      return `充能延后：${event.battleGroupId}/${event.weaponId}`
    case 'attack-resolved': {
      if (event.roll === 0) return `⚔ [区域] ${event.attackerGroupId}/${event.weaponId} 自动命中`
      const outcome = event.hit ? (event.crit ? '会心命中' : '命中') : '未命中'
      return `⚔ ${event.attackerGroupId}/${event.weaponId} → ${event.targetShipId}: ${event.roll}${event.accuracyBonus ? '+' + event.accuracyBonus : ''}${event.difficultyPenalty ? '-' + event.difficultyPenalty : ''} = ${event.total} vs 防御${event.defense} [${outcome}]`
    }
    case 'damage-applied': {
      const fate = event.destroyed ? ' · 击毁!' : event.disabled ? ' · 瘫痪' : ''
      return `伤害：${event.targetGroupId}/${event.targetShipId} -${event.net}（原${event.gross} 阻滞${event.blocked}）${fate}`
    }
    case 'block-rolled':
      return `阻滞：${event.battleGroupId} ${event.blockDice}d6 = ${event.roll}`
    case 'maneuver-performed':
      return `机动：${event.battleGroupId} ${event.maneuver} 距离 ${event.distanceBefore}→${event.distanceAfter}`
    case 'tactic-performed':
      return `战术：${event.battleGroupId} ${event.tactic}`
    case 'status-applied':
      return `状态：${event.battleGroupId} ${event.status}`
    case 'retreat-declared':
      return `撤退：${event.battleGroupId}`
    case 'surrender-declared':
      return `投降：${event.battleGroupId}`
    case 'ship-destroyed':
      return `💥 ${event.battleGroupId}/${event.shipId} 被击毁`
    case 'ship-disabled':
      return `⚡ ${event.battleGroupId}/${event.shipId} 被瘫痪`
    case 'engagement-completed':
      return `战果：${event.outcome}（幸存 ${event.survivorsRatio}）`
    default:
      return event.type
  }
}
