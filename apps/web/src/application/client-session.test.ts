import { connectMemoryClient, createMemoryHostTransport } from '@fleet-campaign/realtime'
import { describe, expect, it } from 'vitest'

import { createClientSession } from './client-session'
import { createHostSession } from './host-session'
import { generateClientId, generateIdempotencyKey } from './ids'

function integration() {
  const hostTransport = createMemoryHostTransport()
  const hostClientId = generateClientId()
  const host = createHostSession({ hostTransport, hostClientId })
  const { roomId } = host.createRoom()

  function dial(clientId = generateClientId(), resumeToken?: string, onToken?: (token: string) => void) {
    const clientTransport = connectMemoryClient(hostTransport)
    const controller = createClientSession({ clientTransport, clientId, resumeToken, onToken })
    return { clientTransport, clientId, controller }
  }

  return { hostTransport, hostClientId, host, roomId, dial }
}

describe('createClientSession', () => {
  it('joins as player, receives token/role/snapshot and reaches connected without exposing the token', () => {
    const itx = integration()
    const { controller } = itx.dial()
    controller.connect(itx.roomId, 'player')
    expect(controller.view.status).toBe('connected')
    expect(controller.view.role).toBe('player')
    expect(controller.view.seat).toBe('guest')
    expect(controller.view.snapshot?.roomId).toBe(itx.roomId)
    expect(controller.view.snapshot?.visibility).toBe('player')
    expect(controller.view.lastError).toBeNull()
    expect(JSON.stringify(controller.view)).not.toContain('t_')
  })

  it('surfaces player_seat_unavailable on a rejected join', () => {
    const itx = integration()
    const first = itx.dial()
    first.controller.connect(itx.roomId, 'player')
    expect(first.controller.view.status).toBe('connected')

    const second = itx.dial()
    second.controller.connect(itx.roomId, 'player')
    expect(second.controller.view.status).toBe('closed')
    expect(second.controller.view.lastError?.code).toBe('player_seat_unavailable')
  })

  it('submits a command-intent that the host settles and the client reflects', () => {
    const itx = integration()
    const { controller } = itx.dial()
    controller.connect(itx.roomId, 'player')
    expect(controller.view.status).toBe('connected')

    expect(itx.host.hostSubmit('start-demo').accepted).toBe(true)
    expect(controller.view.snapshot?.game.phase).toBe('active')

    const key = generateIdempotencyKey()
    expect(controller.sendCommandIntent('advance', key)).toBe(true)
    // host is the active seat, so the guest advance is deterministically rejected.
    expect(controller.view.lastResult?.accepted).toBe(false)
    expect(controller.view.lastError?.code).toBe('not_active_seat')
    expect(controller.view.snapshot?.game.phase).toBe('active')
  })

  it('sends the bound clientId and token on protected frames', () => {
    const itx = integration()
    const { controller } = itx.dial()
    controller.connect(itx.roomId, 'player')
    expect(itx.host.hostSubmit('start-demo').accepted).toBe(true)
    controller.sendCommandIntent('advance', generateIdempotencyKey())
    expect(controller.view.lastError?.code).toBe('not_active_seat')
    expect(controller.view.snapshot?.game.activeSeat).toBe('host')
  })

  it('joins as spectator and gets forbidden_role on state commands', () => {
    const itx = integration()
    const player = itx.dial()
    player.controller.connect(itx.roomId, 'player')
    expect(itx.host.hostSubmit('start-demo').accepted).toBe(true)

    const spec = itx.dial()
    spec.controller.connect(itx.roomId, 'spectator')
    expect(spec.controller.view.status).toBe('connected')
    expect(spec.controller.view.role).toBe('spectator')
    expect(spec.controller.view.seat).toBeNull()

    spec.controller.sendCommandIntent('advance', generateIdempotencyKey())
    expect(spec.controller.view.lastResult?.accepted).toBe(false)
    expect(spec.controller.view.lastError?.code).toBe('forbidden_role')
  })

  it('observes duplicate_connection when the same clientId rejoins on a new connection', () => {
    const itx = integration()
    const clientId = generateClientId()
    let token = ''
    const first = itx.dial(clientId, undefined, (value) => { token = value })
    first.controller.connect(itx.roomId, 'player')
    expect(first.controller.view.status).toBe('connected')

    const second = itx.dial(clientId, token)
    second.controller.connect(itx.roomId, 'player')
    expect(second.controller.view.status).toBe('connected')
    expect(first.controller.view.status).toBe('duplicate_connection')
  })

  it('observes room-closed and ends the session', () => {
    const itx = integration()
    const { controller } = itx.dial()
    controller.connect(itx.roomId, 'player')
    expect(controller.view.status).toBe('connected')

    itx.host.closeRoom()
    expect(controller.view.status).toBe('closed')
    expect(controller.view.snapshot).not.toBeNull()
  })

  it('surfaces transport_unavailable when the endpoint is unreachable', () => {
    const clientTransport = connectMemoryClient(createMemoryHostTransport())
    const controller = createClientSession({
      clientTransport,
      clientId: generateClientId(),
    })
    controller.connect('r_AbCdEfGh1234', 'player')
    expect(controller.view.status).toBe('transport_unavailable')
  })

  it('reconnects after a transport disconnect and receives a full snapshot', () => {
    const itx = integration()
    const { controller } = itx.dial()
    controller.connect(itx.roomId, 'player')
    expect(itx.host.hostSubmit('start-demo').accepted).toBe(true)
    expect(controller.view.snapshot?.game.phase).toBe('active')

    controller.reconnect()
    expect(controller.view.status).toBe('connected')
    expect(controller.view.snapshot?.game.phase).toBe('active')
    expect(controller.view.snapshot?.eventSequence).toBe(1)
  })

  it('revokes the token on explicit leave while preserving disconnect reconnect', () => {
    const itx = integration()
    const clientId = generateClientId()
    let token = ''
    const first = itx.dial(clientId, undefined, (value) => { token = value })
    first.controller.connect(itx.roomId, 'player')
    expect(first.controller.view.status).toBe('connected')

    first.controller.close()
    const stale = itx.dial(clientId, token)
    stale.controller.connect(itx.roomId, 'player')
    expect(stale.controller.view.status).toBe('closed')
    expect(stale.controller.view.lastError?.code).toBe('identity_invalid')
  })
})
