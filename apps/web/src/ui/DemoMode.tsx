import { useEffect, useRef, useState } from 'react'

import { connectMemoryClient, createMemoryHostTransport } from '@fleet-campaign/realtime'

import { createClientSession, type ClientSessionController } from '../application/client-session'
import { createHostSession, type HostSessionController } from '../application/host-session'
import { generateClientId, generateIdempotencyKey } from '../application/ids'
import { useI18n } from '../i18n'
import { GameBoard } from './GameBoard'
import { describeEvent } from './events'

export function DemoMode({ onExit }: { onExit: () => void }) {
  const { t } = useI18n()
  const [resetKey, setResetKey] = useState(0)
  return (
    <section className="room demo">
      <header className="room-head">
        <h2>{t('home.demo')}</h2>
        <div>
          <button className="ghost" onClick={() => setResetKey((key) => key + 1)}>{t('demo.reset')}</button>
          <button className="ghost" onClick={onExit}>{t('host.closeRoom')}</button>
        </div>
      </header>
      <DemoBoard key={resetKey} />
    </section>
  )
}

function DemoBoard() {
  const { t } = useI18n()
  const [, setTick] = useState(0)
  const ref = useRef<{ host: HostSessionController; guest: ClientSessionController } | null>(null)
  const [hostEvents, setHostEvents] = useState<string[]>([])
  const [guestEvents, setGuestEvents] = useState<string[]>([])
  const hostLastSequence = useRef(-1)
  const guestLastSequence = useRef(-1)

  useEffect(() => {
    const hostTransport = createMemoryHostTransport()
    const host = createHostSession({ hostTransport, hostClientId: generateClientId() })
    const created = host.createRoom()
    const guestTransport = connectMemoryClient(hostTransport)
    const guest = createClientSession({ clientTransport: guestTransport, clientId: generateClientId(), onToken: () => {} })
    const unsubHost = host.subscribe(() => {
      const lastEvent = host.getView().lastEvent
      if (lastEvent && lastEvent.eventSequence !== hostLastSequence.current) {
        hostLastSequence.current = lastEvent.eventSequence
        setHostEvents((prev) => [...prev, describeEvent(lastEvent)])
      }
      setTick((next) => next + 1)
    })
    const unsubGuest = guest.subscribe(() => {
      const broadcast = guest.view.lastBroadcast
      if (broadcast && broadcast.eventSequence !== guestLastSequence.current) {
        guestLastSequence.current = broadcast.eventSequence
        setGuestEvents((prev) => [...prev, describeEvent(broadcast)])
      }
      setTick((next) => next + 1)
    })
    guest.connect(created.roomId, 'player')
    ref.current = { host, guest }
    return () => {
      unsubHost()
      unsubGuest()
      host.closeRoom()
      guest.close()
    }
  }, [])

  const hostView = ref.current?.host.getView() ?? null
  const guestView = ref.current?.guest.view ?? null

  function hostSubmit(command: 'start-demo' | 'advance'): void {
    ref.current?.host.hostSubmit(command)
  }

  return (
    <div className="demo-panes">
      <div className="demo-pane">
        <h3>{t('demo.hostPane')}</h3>
        <GameBoard
          snapshot={hostView?.snapshot ?? null}
          seat="host"
          visibility="host"
          onStart={() => hostSubmit('start-demo')}
          canStart={hostView?.hasPlayer}
          onAdvance={() => hostSubmit('advance')}
          events={hostEvents}
        />
      </div>
      <div className="demo-pane">
        <h3>{t('demo.guestPane')}</h3>
        <GameBoard
          snapshot={guestView?.snapshot ?? null}
          seat={guestView?.seat ?? null}
          visibility={guestView?.role ?? null}
          onAdvance={() => ref.current?.guest.sendCommandIntent('advance', generateIdempotencyKey())}
          events={guestEvents}
        />
      </div>
    </div>
  )
}
