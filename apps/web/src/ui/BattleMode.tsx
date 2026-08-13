import { useMemo, useState } from 'react'

import type { BattleGroupState, BattleShipState, BattleState, BattleWeaponState } from '@fleet-campaign/battle'

import { ARCHETYPE_LABEL, deriveBotState } from '@fleet-campaign/battle'

import { useBattleController } from '../application/use-battle-controller'
import { useI18n } from '../i18n'
import { describeBattleEvent } from './battle-events'
import { HoloMapCanvas } from './HoloMapCanvas'

export const BAND_NAMES = ['至近', '近', '坍缩', '瞄准镜', '长', '极限'] as const

/** 按距离带号取名称（带 0=至近 … 带 5=极限）。 */
export function bandName(band: number): string {
  return BAND_NAMES[band] ?? String(band)
}

const PHASES = ['logistics', 'ballistics', 'action', 'boarding'] as const
const PHASE_LABEL: Record<string, string> = {
  logistics: '后勤',
  ballistics: '弹着',
  action: '行动',
  boarding: '接舷',
}

function weaponCounters(weapon: BattleWeaponState): string[] {
  const pips: string[] = []
  if (weapon.charge !== null) pips.push(`充能${weapon.charge}`)
  if (weapon.flight !== null) pips.push(`飞行${weapon.flight}`)
  if (weapon.reload !== null) pips.push(`装填${weapon.reload}`)
  if (weapon.payload) pips.push('酬载')
  if (weapon.area) pips.push('区域')
  if (weapon.crit) pips.push('会心')
  return pips
}

function ShipCard({ ship, self, onSelect, selected }: { ship: BattleShipState; self: boolean; onSelect?: () => void; selected?: boolean }) {
  const color = self ? '#59d8ff' : '#ffb34d'
  const hpRatio = ship.maxHp > 0 ? ship.hp / ship.maxHp : 0
  return (
    <div className={`b-ship ${ship.status !== 'active' ? 'down' : ''} ${selected ? 'sel' : ''}`} onClick={onSelect}>
      <div className="b-ship-head">
        <span className="b-ship-name" style={{ color }}>
          {ship.id}
          {ship.flag ? '★' : ''}
        </span>
        <span className="b-ship-type">{ship.type}</span>
        <span className="b-ship-hp">
          {ship.hp}/{ship.maxHp}
        </span>
      </div>
      <div className="b-hpbar">
        <i style={{ width: `${hpRatio * 100}%`, background: color }} />
      </div>
      {ship.status !== 'active' ? <div className="b-ship-status">{ship.status}</div> : null}
      <div className="b-weapons">
        {ship.weapons.map((weapon) => (
          <div key={weapon.weaponId} className="b-weapon">
            <span>{weapon.weaponId}</span>
            <span className="b-weapon-dmg">{weapon.damage}</span>
            <span className="b-weapon-cnt">{weaponCounters(weapon).join(' · ') || `距离${weapon.range}`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FleetPanel({
  title,
  group,
  self,
  state,
  showBot,
  selectedShipId,
  onSelectShip,
}: {
  title: string
  group: BattleGroupState
  self: boolean
  state: BattleState
  showBot?: boolean
  selectedShipId: string | null
  onSelectShip: (shipId: string) => void
}) {
  const archetype =
    showBot && group.status === 'active' ? ` · bot ${ARCHETYPE_LABEL[deriveBotState(state, group.id).archetype]}` : ''
  return (
    <div className="b-panel">
      <div className="b-panel-title">
        {title} · {group.faction}
        <span className="b-archetype">{archetype}</span>
      </div>
      <div className="b-fleet-meta">
        <span className="b-chip">带 {group.distance} {bandName(group.distance)}</span>
        <span className="b-chip">阻滞 {group.blockDice}d6</span>
        <span className="b-chip">{group.status}</span>
      </div>
      <ShipCard ship={group.flagship} self={self} selected={selectedShipId === group.flagship.id} onSelect={() => onSelectShip(group.flagship.id)} />
      {group.ships.map((ship) => (
        <ShipCard key={ship.id} ship={ship} self={self} selected={selectedShipId === ship.id} onSelect={() => onSelectShip(ship.id)} />
      ))}
    </div>
  )
}

/** 指令坞状态：null=空闲；对象=索敌模式（点敌方舰后提交该命令）。 */
type Targeting = { command: 'full-thrust-fire' | 'all-guns-fire' | 'lock-on'; weaponId?: string } | null

export function BattleMode({ onExit }: { onExit: () => void }) {
  const { t } = useI18n()
  const controller = useBattleController()
  const { state, events } = controller
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null)
  const [targeting, setTargeting] = useState<Targeting>(null)

  const player = state.battleGroups.find((g) => g.faction === 'player')
  const enemy = state.battleGroups.find((g) => g.faction === 'enemy')
  const myTurn = state.phase === 'action' && state.activeGroupId === player?.id
  const completed = state.phase === 'completed'
  const eventLog = useMemo(() => events.map(describeBattleEvent), [events])

  const playerGroup = player!
  const enemyGroup = enemy!

  const selectedPlayerShip = playerGroup
    ? [playerGroup.flagship, ...playerGroup.ships].find((s) => s.id === selectedShipId) ?? null
    : null

  /** 所选舰可发射的武器（非充能；充能走弹着）。 */
  const firableWeapons = selectedPlayerShip
    ? selectedPlayerShip.weapons.filter((w) => w.charge === null && playerGroup.distance <= w.range)
    : []

  function targetingLabel(): string | null {
    if (!targeting) return null
    if (targeting.command === 'full-thrust-fire') return `索敌：全速前进攻击（${targeting.weaponId ?? '主武器'}）→ 点敌方`
    if (targeting.command === 'all-guns-fire') return '索敌：全舰开火 → 点敌方'
    return '索敌：锁定 → 点敌方'
  }

  function handleTargetShip(shipId: string, groupId: string): void {
    if (!targeting) return
    if (targeting.command === 'full-thrust-fire') {
      controller.submit({
        type: 'maneuver',
        actorId: 'player',
        battleGroupId: playerGroup.id,
        maneuver: 'full-thrust',
        attacks: [{ weaponId: targeting.weaponId!, target: { groupId, shipId } }],
      })
    } else if (targeting.command === 'all-guns-fire') {
      // 1 超重 或 至多 2 不同武器。
      const superheavy = firableWeapons.find((w) => w.size === 'superheavy')
      const attacks = superheavy
        ? [{ weaponId: superheavy.weaponId, target: { groupId, shipId } }]
        : firableWeapons.slice(0, 2).map((w) => ({ weaponId: w.weaponId, target: { groupId, shipId } }))
      controller.submit({
        type: 'maneuver',
        actorId: 'player',
        battleGroupId: playerGroup.id,
        maneuver: 'all-guns-fire',
        attacks,
      })
    } else {
      controller.submit({ type: 'tactic', actorId: 'player', battleGroupId: playerGroup.id, tactic: 'lock-on', target: { groupId, shipId } })
    }
    setTargeting(null)
  }

  return (
    <section className="battle">
      <header className="b-top">
        <span className="b-brand">FLEET COMMAND · CIC</span>
        <span className="b-round">ROUND {state.round}</span>
        <div className="b-phases">
          {PHASES.map((phase) => (
            <span key={phase} className={`b-phase ${state.phase === phase ? 'on' : ''}`}>
              {PHASE_LABEL[phase]}
            </span>
          ))}
        </div>
        <span className="b-seed">seed {controller.seed.toString()}</span>
        <div className="b-top-actions">
          <button className="ghost" onClick={controller.reset}>{t('demo.reset')}</button>
          <button className="ghost" onClick={onExit}>{t('host.closeRoom')}</button>
        </div>
      </header>

      <div className="b-body">
        <FleetPanel
          title="我方"
          group={playerGroup}
          self
          state={state}
          selectedShipId={selectedShipId}
          onSelectShip={(id) => setSelectedShipId(id)}
        />
        <div className="b-stage">
          <HoloMapCanvas
            state={state}
            selectedShipId={selectedShipId}
            targetingLabel={targetingLabel()}
            pendingEvents={events}
            onSelectShip={(id) => setSelectedShipId(id)}
            onTargetShip={handleTargetShip}
          />

          <div className="b-dock">
            <div className="b-dock-status">
              {completed
                ? `战果：${state.outcome}`
                : myTurn
                  ? '我方行动'
                  : state.phase === 'action'
                    ? '敌方 bot 行动…'
                    : PHASE_LABEL[state.phase]}
              {controller.lastRejection ? <span className="b-reject"> · 拒绝：{controller.lastRejection}</span> : null}
            </div>

            {targeting ? (
              <div className="b-dock-cmds">
                <span className="b-cmd-label">{targetingLabel()}</span>
                <button className="b-cmd" onClick={() => setTargeting(null)}>取消</button>
              </div>
            ) : null}

            {!completed && state.phase === 'action' && myTurn && !targeting ? (
              <div className="b-dock-cmds">
                <span className="b-cmd-label">机动</span>
                <button
                  className="b-cmd"
                  disabled={!firableWeapons.some((w) => w.size === 'main')}
                  onClick={() =>
                    setTargeting({ command: 'full-thrust-fire', weaponId: firableWeapons.find((w) => w.size === 'main')?.weaponId })
                  }
                >
                  全速前进·主炮
                </button>
                <button
                  className="b-cmd"
                  disabled={!firableWeapons.some((w) => w.size === 'superheavy') && firableWeapons.length < 2}
                  onClick={() => setTargeting({ command: 'all-guns-fire' })}
                >
                  全舰开火
                </button>
                <button
                  className="b-cmd"
                  onClick={() => controller.submit({ type: 'maneuver', actorId: 'player', battleGroupId: playerGroup.id, maneuver: 'retro-thrust', retreat: true })}
                >
                  反向喷射
                </button>
                <span className="b-cmd-label">战术</span>
                <button className="b-cmd" onClick={() => setTargeting({ command: 'lock-on' })}>
                  锁定
                </button>
                <button
                  className="b-cmd"
                  onClick={() => controller.submit({ type: 'tactic', actorId: 'player', battleGroupId: playerGroup.id, tactic: 'careful-fire' })}
                >
                  谨慎射击
                </button>
                <span className="b-cmd-label">回合</span>
                <button className="b-cmd" onClick={() => controller.submit({ type: 'end-turn', actorId: 'player', battleGroupId: playerGroup.id })}>
                  结束回合
                </button>
              </div>
            ) : null}

            {!completed && state.phase === 'ballistics' && controller.playerReadyCharged.length > 0 ? (
              <div className="b-dock-cmds">
                <span className="b-cmd-label">弹着</span>
                {controller.playerReadyCharged.map((w) => (
                  <button key={w.weaponId} className="b-cmd on" onClick={() => controller.fireCharged(w.weaponId)}>
                    开火 {w.weaponId}
                  </button>
                ))}
                <button className="b-cmd primary" onClick={controller.advancePhase}>
                  推进阶段（跳过）
                </button>
              </div>
            ) : null}

            {!completed && !myTurn && state.phase !== 'ballistics' ? (
              <div className="b-dock-cmds">
                <button className="b-cmd primary" onClick={controller.advancePhase}>
                  推进阶段
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <FleetPanel
          title="敌方"
          group={enemyGroup}
          self={false}
          state={state}
          showBot
          selectedShipId={selectedShipId}
          onSelectShip={(id) => setSelectedShipId(id)}
        />
      </div>

      <div className="b-log">
        <div className="b-log-title">事件 / 检定</div>
        <ul className="b-log-list">
          {eventLog.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
