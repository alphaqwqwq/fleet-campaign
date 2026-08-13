import { describe, expect, it } from 'vitest'

import { connectMemoryClient, createMemoryHostTransport } from '@fleet-campaign/realtime'

import { createClientSession } from './client-session'
import { createHostSession } from './host-session'
import { generateClientId, generateIdempotencyKey } from './ids'
import { buildCampaignSave, gameStateFromView } from './session-utils'
import { checkInvariants } from '@fleet-campaign/domain'

function waitFor(predicate: () => boolean, message = 'timeout'): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const poll = (): void => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - started > 2_000) {
        reject(new Error(message))
        return
      }
      setTimeout(poll, 0)
    }
    poll()
  })
}

/** 从裁决结果安全提取事件序列（被拒结果无事件，返回 -1）。 */
function resultSequence(result: import('@fleet-campaign/protocol').CommandResult | null): number {
  return result?.accepted === true ? (result.event?.eventSequence ?? -1) : -1
}

describe('web vertical slice over memory transport', () => {
  it('host and guest play a full demo loop to completion', async () => {
    const hostTransport = createMemoryHostTransport()
    const host = createHostSession({ hostTransport, hostClientId: generateClientId() })
    const created = host.createRoom()
    const guestTransport = connectMemoryClient(hostTransport)
    const guest = createClientSession({ clientTransport: guestTransport, clientId: generateClientId(), onToken: () => {} })
    guest.connect(created.roomId, 'player')
    await waitFor(() => guest.view.status === 'connected' && guest.view.snapshot !== null)
    expect(guest.view.snapshot).not.toBeNull()
    expect(host.getView().hasPlayer).toBe(true)
    expect(guest.view.seat).toBe('guest')

    const start = host.hostSubmit('start-demo')
    expect(start.accepted).toBe(true)
    await waitFor(() => guest.view.snapshot?.game.phase === 'active')
    expect(guest.view.snapshot?.game.round).toBe(1)
    expect(guest.view.snapshot?.game.activeSeat).toBe('host')

    const actions: string[] = []
    while (host.getView().snapshot?.game.phase === 'active') {
      const seat = host.getView().snapshot?.game.activeSeat
      if (seat === 'host') {
        const result = host.hostSubmit('advance')
        expect(result.accepted).toBe(true)
        actions.push('host')
      } else if (seat === 'guest') {
        const before = resultSequence(guest.view.lastResult)
        expect(guest.sendCommandIntent('advance', generateIdempotencyKey())).toBe(true)
        await waitFor(() => resultSequence(guest.view.lastResult) > before)
        expect(guest.view.lastResult?.accepted).toBe(true)
        actions.push('guest')
      } else {
        throw new Error(`unexpected activeSeat ${String(seat)}`)
      }
    }

    const final = host.getView().snapshot?.game
    expect(final?.phase).toBe('completed')
    expect(final?.winnerSeat).toBeTruthy()
    expect(actions.length).toBe(5)
    expect(actions.slice(-1)[0]).toBe('host')
    expect(actions).toEqual(['host', 'guest', 'host', 'guest', 'host'])
  })

  it('spectators are rejected for state-changing commands', async () => {
    const hostTransport = createMemoryHostTransport()
    const host = createHostSession({ hostTransport, hostClientId: generateClientId() })
    const created = host.createRoom()
    const spectatorTransport = connectMemoryClient(hostTransport)
    const spectator = createClientSession({ clientTransport: spectatorTransport, clientId: generateClientId(), onToken: () => {} })
    spectator.connect(created.roomId, 'spectator')
    await waitFor(() => spectator.view.status === 'connected' && spectator.view.snapshot !== null)
    expect(spectator.view.seat).toBeNull()

    spectator.sendCommandIntent('advance', generateIdempotencyKey())
    await waitFor(() => spectator.view.lastResult !== null)
    expect(spectator.view.lastResult).toMatchObject({ accepted: false, errorCode: 'forbidden_role' })
  })

  it('builds a demo-v1 save and reconstructs a valid game state', async () => {
    const hostTransport = createMemoryHostTransport()
    const host = createHostSession({ hostTransport, hostClientId: generateClientId() })
    const created = host.createRoom()
    const guestTransport = connectMemoryClient(hostTransport)
    const guest = createClientSession({ clientTransport: guestTransport, clientId: generateClientId(), onToken: () => {} })
    guest.connect(created.roomId, 'player')
    await waitFor(() => guest.view.status === 'connected')
    const start = host.hostSubmit('start-demo')
    expect(start.accepted).toBe(true)

    const view = host.getView()
    const save = buildCampaignSave(view.campaignId, view.seed, view.snapshot)
    expect(save.schemaVersion).toBe(1)
    expect(save.contentId).toBe('demo-v1')
    expect(save.rngState.seed).toBe(view.seed)
    expect(save.rngState.index).toBe(0)

    const state = gameStateFromView(save.gameSnapshot)
    expect(state.contentId).toBe('demo-v1')
    expect(state.phase).toBe('active')
    expect(state.round).toBe(1)
    expect(state.activeSeat).toBe('host')
    expect(checkInvariants(state)).toEqual([])
  })
})




