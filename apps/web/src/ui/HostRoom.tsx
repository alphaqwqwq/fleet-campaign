import { useEffect, useRef, useState } from 'react'

import type { CampaignSave } from '@fleet-campaign/persistence'

import { createHostSession } from '../application/host-session'
import {
  buildCampaignSave,
  createHostTransport,
  createPersistence,
  gameStateFromView,
  getOrCreateClientId,
} from '../application/session-utils'
import { useI18n } from '../i18n'
import { GameBoard } from './GameBoard'
import { describeEvent } from './events'

export function HostRoom({ onExit }: { onExit: () => void }) {
  const { t } = useI18n()
  const [host] = useState(() =>
    createHostSession({ hostTransport: createHostTransport(), hostClientId: getOrCreateClientId() }),
  )
  const persistence = useRef(createPersistence())
  const fileInput = useRef<HTMLInputElement>(null)
  const [, setTick] = useState(0)
  const [events, setEvents] = useState<string[]>([])
  const lastEventSequence = useRef(-1)
  const [saves, setSaves] = useState<CampaignSave[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const unsubscribe = host.subscribe(() => {
      const lastEvent = host.getView().lastEvent
      if (lastEvent && lastEvent.eventSequence !== lastEventSequence.current) {
        lastEventSequence.current = lastEvent.eventSequence
        setEvents((prev) => [...prev, describeEvent(lastEvent)])
      }
      setTick((next) => next + 1)
    })
    const created = host.createRoom()
    setRoomId(created.roomId)
    void refreshSaves()
    return () => {
      unsubscribe()
      host.closeRoom()
    }
  }, [host])

  async function refreshSaves(): Promise<void> {
    try {
      const list = await persistence.current.list()
      setSaves(list)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    }
  }

  function handleNotice(error: unknown): void {
    setNotice(error instanceof Error ? error.message : String(error))
  }

  function submit(command: 'start-demo' | 'advance'): void {
    host.hostSubmit(command)
    setTick((next) => next + 1)
  }

  async function handleSave(): Promise<void> {
    setBusy(true)
    try {
      const view = host.getView()
      const save = buildCampaignSave(view.campaignId, view.seed, view.snapshot)
      await persistence.current.save(save)
      setNotice(t('host.saved'))
      await refreshSaves()
    } catch (error) {
      handleNotice(error)
    } finally {
      setBusy(false)
    }
  }

  async function handleExport(): Promise<void> {
    setBusy(true)
    try {
      const serialized = await persistence.current.export(host.getView().campaignId)
      const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `fleet-campaign-${host.getView().campaignId}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      handleNotice(error)
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(file: File): Promise<void> {
    setBusy(true)
    try {
      const save = await persistence.current.import(await file.text())
      host.resume(gameStateFromView(save.gameSnapshot), save.rngState.seed, save.campaignId)
      setNotice(t('host.saved'))
      await refreshSaves()
    } catch (error) {
      handleNotice(error)
    } finally {
      setBusy(false)
    }
  }

  async function handleResume(save: CampaignSave): Promise<void> {
    setBusy(true)
    try {
      host.resume(gameStateFromView(save.gameSnapshot), save.rngState.seed, save.campaignId)
      setNotice(t('host.saved'))
    } catch (error) {
      handleNotice(error)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(save: CampaignSave): Promise<void> {
    await persistence.current.delete(save.campaignId)
    await refreshSaves()
  }

  async function copyRoomCode(): Promise<void> {
    await navigator.clipboard?.writeText(roomId)
    setCopied(true)
  }

  const view = host.getView()
  const snapshot = view.snapshot

  return (
    <section className="room">
      <header className="room-head">
        <div>
          <h2>{t('home.createRoom')}</h2>
          <p className="muted">
            {t('host.roomCode')}: <code className="room-code">{roomId || '…'}</code>
            <button className="link" onClick={() => void copyRoomCode()} disabled={!roomId}>
              {copied ? '✓' : t('host.roomCodeHint')}
            </button>
          </p>
          <p className="muted">
            {t('host.campaignId')}: <code>{view.campaignId}</code>
          </p>
        </div>
        <button className="ghost" onClick={() => { host.closeRoom(); onExit() }}>
          {t('host.closeRoom')}
        </button>
      </header>

      <p className="roster">
        {t('host.connectedClients')}: {view.roster.map((entry) => `${entry.role}(${entry.seat ?? '—'})`).join(' · ') || '—'}
      </p>

      <GameBoard
        snapshot={snapshot}
        seat="host"
        visibility="host"
        onStart={() => submit('start-demo')}
        canStart={view.hasPlayer}
        onAdvance={() => submit('advance')}
        events={events}
        footer={
          <div className="save-panel">
            <div className="toolbar">
              <button onClick={() => void handleSave()} disabled={busy || !snapshot}>{t('host.save')}</button>
              <button onClick={() => void handleExport()} disabled={busy || !snapshot}>{t('host.export')}</button>
              <button onClick={() => fileInput.current?.click()} disabled={busy}>{t('host.import')}</button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleImportFile(file)
                  event.target.value = ''
                }}
              />
            </div>
            <p className="muted small">{t('host.loadHint')}</p>
            <ul className="save-list">
              {saves.length === 0 ? (
                <li className="muted">{t('host.noSaves')}</li>
              ) : (
                saves.map((save) => (
                  <li key={save.campaignId}>
                    <span>
                      {save.savedAt.slice(0, 16).replace('T', ' ')} · {save.gameSnapshot.phase}
                    </span>
                    <span className="save-actions">
                      <button onClick={() => void handleResume(save)} disabled={busy}>{t('host.resume')}</button>
                      <button onClick={() => void handleDelete(save)} disabled={busy}>×</button>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        }
      />

      {notice ? <p className="notice" role="status">{notice}</p> : null}
    </section>
  )
}
