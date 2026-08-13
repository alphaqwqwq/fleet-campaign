import { useEffect, useRef, useState } from 'react'

import type { RequestedRole } from '@fleet-campaign/realtime'

import { createClientSession } from '../application/client-session'
import { generateIdempotencyKey } from '../application/ids'
import {
  clearResumeToken,
  createClientTransport,
  getOrCreateClientId,
  readResumeToken,
  writeResumeToken,
} from '../application/session-utils'
import { messageKeyToI18nKey, useI18n, type I18nKey } from '../i18n'
import { GameBoard } from './GameBoard'
import { describeEvent } from './events'

export function JoinRoom({ onExit }: { onExit: () => void }) {
  const { t } = useI18n()
  const [roomCode, setRoomCode] = useState('')
  const [role, setRole] = useState<RequestedRole>('player')
  const [joined, setJoined] = useState(false)
  const [tick, setTick] = useState(0)
  const [events, setEvents] = useState<string[]>([])
  const sessionRef = useRef<ReturnType<typeof createClientSession> | null>(null)
  const lastEventSequence = useRef(-1)

  useEffect(() => {
    return () => {
      sessionRef.current?.close()
    }
  }, [])

  // 会话终态（房主关闭 / 身份被拒）→ 清掉陈旧令牌并回到加入表单，允许干净重试。
  useEffect(() => {
    if (!joined) return
    const current = sessionRef.current?.view
    if (!current || current.status !== 'closed') return
    clearResumeToken(roomCode.trim())
    sessionRef.current?.close()
    sessionRef.current = null
    setJoined(false)
    setEvents([])
  }, [tick, joined, roomCode])

  function join(): void {
    const code = roomCode.trim()
    if (!code) return
    const session = createClientSession({
      clientTransport: createClientTransport(),
      clientId: getOrCreateClientId(),
      resumeToken: readResumeToken(code),
      onToken: (token) => writeResumeToken(code, token),
    })
    session.subscribe(() => {
      const result = session.view.lastResult
      if (result && result.accepted && result.event && result.event.eventSequence !== lastEventSequence.current) {
        lastEventSequence.current = result.event.eventSequence
        setEvents((prev) => [...prev, describeEvent(result.event)])
      }
      setTick((next) => next + 1)
    })
    sessionRef.current = session
    session.connect(code, role)
    setJoined(true)
  }

  function leave(): void {
    void sessionRef.current?.close()
    clearResumeToken(roomCode.trim())
    onExit()
  }

  const view = sessionRef.current?.view
  const status = view?.status ?? 'idle'
  const connected = status === 'connected'
  const errorKey = view?.lastError ? messageKeyToI18nKey(view.lastError.messageKey) : null

  const STATUS_KEYS: Record<string, I18nKey> = {
    idle: 'status.connecting',
    connecting: 'status.connecting',
    joining: 'status.joining',
    connected: 'status.connected',
    reconnecting: 'status.reconnecting',
    disconnected: 'status.disconnected',
    closed: 'status.closed',
    duplicate_connection: 'status.duplicate',
    transport_unavailable: 'status.unavailable',
  }

  if (!joined) {
    return (
      <section className="room">
        <header className="room-head">
          <h2>{t('home.joinRoom')}</h2>
          <button className="ghost" onClick={onExit}>{t('join.leave')}</button>
        </header>
        <form
          className="join-form"
          onSubmit={(event) => {
            event.preventDefault()
            join()
          }}
        >
          <label>
            {t('join.roomCodeLabel')}
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder={t('join.roomCodePlaceholder')}
              autoComplete="off"
              required
            />
          </label>
          <fieldset>
            <legend>{t('join.roleLabel')}</legend>
            <label>
              <input type="radio" name="role" checked={role === 'player'} onChange={() => setRole('player')} />
              {t('join.rolePlayer')}
            </label>
            <label>
              <input type="radio" name="role" checked={role === 'spectator'} onChange={() => setRole('spectator')} />
              {t('join.roleSpectator')}
            </label>
          </fieldset>
          <button className="primary" type="submit">{t('join.submit')}</button>
        </form>
      </section>
    )
  }

  return (
    <section className="room">
      <header className="room-head">
        <div>
          <h2>{t('home.joinRoom')}</h2>
          <p className="muted">
            {t('join.roomCodeLabel')}: <code>{roomCode}</code>
          </p>
        </div>
        <div>
          {status === 'disconnected' || status === 'transport_unavailable' ? (
            <button className="ghost" onClick={() => sessionRef.current?.reconnect()}>{t('join.reconnect')}</button>
          ) : null}
          <button className="ghost" onClick={leave}>{t('join.leave')}</button>
        </div>
      </header>

      <p className="roster" role="status">
        {t(STATUS_KEYS[status])}
        {view?.seat ? ` · ${view.seat}` : ''}
      </p>

      {errorKey ? <p className="notice" role="status">{t(errorKey)}</p> : null}

      {connected ? (
        <GameBoard
          snapshot={view?.snapshot ?? null}
          seat={view?.seat ?? null}
          visibility={view?.role ?? null}
          onAdvance={() => {
            sessionRef.current?.sendCommandIntent('advance', generateIdempotencyKey())
          }}
          events={events}
        />
      ) : null}
    </section>
  )
}
