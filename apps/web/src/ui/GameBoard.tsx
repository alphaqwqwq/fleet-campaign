import type { ReactNode } from 'react'

import type { SeatId } from '@fleet-campaign/domain'
import type { Snapshot } from '@fleet-campaign/protocol'

import { useI18n } from '../i18n'

export interface GameBoardProps {
  snapshot: Snapshot | null
  seat: SeatId | null
  visibility: 'host' | 'player' | 'spectator' | null
  onStart?: () => void
  canStart?: boolean
  onAdvance: () => void
  events: string[]
  footer?: ReactNode
}

export function GameBoard({ snapshot, seat, visibility, onStart, canStart, onAdvance, events, footer }: GameBoardProps) {
  const { t } = useI18n()
  if (!snapshot) return <p className="muted">{t('join.waiting')}</p>

  const game = snapshot.game
  const active = game.activeSeat
  const myTurn = game.phase === 'active' && active === seat
  const completed = game.phase === 'completed'

  return (
    <section className="board" aria-label={t('board.round')}>
      <div className="board-row">
        <span className="chip">{t('board.round')} {game.round}</span>
        <span className="chip">{t('board.actionPoints')} {game.actionPoints}</span>
        <span className="chip">{t('board.activeSeat')} {active ?? '—'}</span>
      </div>

      <div className="units">
        {game.units.map((unit) => (
          <div key={unit.id} className={`unit ${unit.id === `${seat ?? 'none'}-unit` ? 'self' : ''}`}>
            <span className="unit-name">{unit.id === 'host-unit' ? t('board.hostUnit') : t('board.guestUnit')}</span>
            <span className="integrity">{t('board.integrity')} {unit.integrity}</span>
          </div>
        ))}
      </div>

      <p className="turn-status" role="status">
        {completed
          ? `${t('board.completed')} · ${t('board.winner')}: ${game.winnerSeat ?? '—'}`
          : myTurn
            ? t('board.yourTurn')
            : visibility === 'spectator'
              ? t('board.spectating')
              : t('board.waitingTurn')}
      </p>

      <div className="actions">
        {onStart && game.phase === 'awaiting-player' ? (
          <button className="primary" onClick={onStart} disabled={canStart === false}>
            {t('host.startDemo')}
          </button>
        ) : null}
        {game.phase === 'active' ? (
          <button className="primary" onClick={onAdvance} disabled={!myTurn}>
            {t('host.advance')}
          </button>
        ) : null}
      </div>

      {events.length > 0 ? (
        <ul className="events" aria-label={t('board.events')}>
          {events.map((event, index) => (
            <li key={index}>{event}</li>
          ))}
        </ul>
      ) : null}

      {footer}
    </section>
  )
}
