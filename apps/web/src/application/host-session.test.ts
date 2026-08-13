import type {
  ClientStatus,
  CommandIntentFrame,
  HostToClientFrame,
  JoinAcceptedFrame,
  SnapshotFrame,
} from '@fleet-campaign/realtime'
import {
  connectMemoryClient,
  createMemoryHostTransport,
  generateSessionToken,
  MemoryHostTransport,
} from '@fleet-campaign/realtime'
import { describe, expect, it } from 'vitest'

import { createHostSession } from './host-session'
import { generateClientId } from './ids'

function joinFrame(clientId: string, roomId: string, role: 'player' | 'spectator', messageId = 'm-join', token?: string) {
  return {
    frame: 'join-request' as const,
    protocolVersion: 1 as const,
    messageId,
    roomId,
    clientId,
    requestedRole: role,
    token,
  }
}

function intentFrame(opts: {
  roomId: string
  clientId: string
  token: string
  command: 'start-demo' | 'advance'
  idempotencyKey: string
  expectedEventSequence: number
  messageId?: string
  intentRoomId?: string
  intentSenderClientId?: string
}): CommandIntentFrame {
  return {
    frame: 'command-intent' as const,
    protocolVersion: 1 as const,
    messageId: opts.messageId ?? 'm-intent',
    roomId: opts.roomId,
    clientId: opts.clientId,
    token: opts.token,
    intent: {
      protocolVersion: 1 as const,
      messageId: 'm-inner',
      roomId: opts.intentRoomId ?? opts.roomId,
      senderClientId: opts.intentSenderClientId ?? opts.clientId,
      kind: 'command-intent' as const,
      idempotencyKey: opts.idempotencyKey,
      expectedEventSequence: opts.expectedEventSequence,
      command: { type: opts.command },
    },
  }
}

function leaveFrame(clientId: string, roomId: string, token: string) {
  return {
    frame: 'leave-request' as const,
    protocolVersion: 1 as const,
    messageId: 'm-leave',
    roomId,
    clientId,
    token,
  }
}

function harness() {
  const hostTransport = createMemoryHostTransport()
  const hostClientId = generateClientId()
  const controller = createHostSession({ hostTransport, hostClientId })
  const created = controller.createRoom()
  const roomId = created.roomId

  function connect() {
    const client = connectMemoryClient(hostTransport)
    const statuses: ClientStatus[] = []
    const frames: HostToClientFrame[] = []
    client.setEvents({
      onStatus: (s) => statuses.push(s),
      onFrame: (f) => frames.push(f),
    })
    client.connect(roomId)
    return { client, statuses, frames }
  }

  function join(clientId: string, role: 'player' | 'spectator', conn: ReturnType<typeof connect> | null = null, token?: string) {
    const c = conn ?? connect()
    expect(c.client.send(joinFrame(clientId, roomId, role, 'm-join', token))).toBe(true)
    return c
  }

  function acceptedFor(conn: ReturnType<typeof connect>): JoinAcceptedFrame {
    const accepted = conn.frames.find((f): f is JoinAcceptedFrame => f.frame === 'join-accepted')
    expect(accepted).toBeDefined()
    return accepted as JoinAcceptedFrame
  }

  function snapshotsFor(conn: ReturnType<typeof connect>): SnapshotFrame[] {
    return conn.frames.filter((f): f is SnapshotFrame => f.frame === 'snapshot')
  }

  function sendIntent(
    conn: ReturnType<typeof connect>,
    opts: {
      token: string
      command: 'start-demo' | 'advance'
      idempotencyKey: string
      expectedEventSequence: number
      clientId?: string
      intentRoomId?: string
      intentSenderClientId?: string
    },
  ) {
    const before = conn.frames.length
    expect(
      conn.client.send(
        intentFrame({
          roomId,
          clientId: opts.clientId ?? acceptedFor(conn).clientId,
          token: opts.token,
          command: opts.command,
          idempotencyKey: opts.idempotencyKey,
          expectedEventSequence: opts.expectedEventSequence,
          intentRoomId: opts.intentRoomId,
          intentSenderClientId: opts.intentSenderClientId,
        }),
      ),
    ).toBe(true)
    const newFrames = conn.frames.slice(before)
    return newFrames
  }

  return {
    hostTransport,
    hostClientId,
    controller,
    roomId,
    created,
    connect,
    join,
    acceptedFor,
    snapshotsFor,
    sendIntent,
  }
}

function gameOf(snapshot: SnapshotFrame['snapshot']) {
  return snapshot.game
}

describe('createHostSession', () => {
  it('creates a room with valid ids and opens the endpoint', () => {
    const h = harness()
    expect(h.roomId).toMatch(/^r_[A-Za-z0-9_-]{12}$/)
    expect(h.created.campaignId).toMatch(/^c_/)
    expect(h.controller.status).toBe('open')
    expect(h.hostTransport.status).toBe('open')
    expect(h.hostTransport.roomId).toBe(h.roomId)
  })

  it('accepts a player join and downlinks token + full snapshot', () => {
    const h = harness()
    const playerId = generateClientId()
    const conn = h.join(playerId, 'player')
    const accepted = h.acceptedFor(conn)
    expect(accepted.role).toBe('player')
    expect(accepted.seat).toBe('guest')
    expect(accepted.clientId).toBe(playerId)
    expect(accepted.token).toMatch(/^t_/)

    const snapshot = h.snapshotsFor(conn)[0]
    expect(snapshot.snapshot.roomId).toBe(h.roomId)
    expect(snapshot.snapshot.visibility).toBe('player')
    expect(snapshot.snapshot.eventSequence).toBe(0)
    expect(snapshot.snapshot.roster).toContainEqual({ clientId: h.hostClientId, seat: 'host', role: 'host' })
    expect(snapshot.snapshot.roster).toContainEqual({ clientId: playerId, seat: 'guest', role: 'player' })
    expect(gameOf(snapshot.snapshot).phase).toBe('awaiting-player')
  })

  it('rejects a second player with player_seat_unavailable and does not replace the first', () => {
    const h = harness()
    const first = h.join(generateClientId(), 'player')
    const firstAccepted = h.acceptedFor(first)
    const second = h.join(generateClientId(), 'player')

    const rejected = second.frames.find((f) => f.frame === 'join-rejected')
    expect(rejected).toBeDefined()
    expect(rejected && 'errorCode' in rejected ? rejected.errorCode : null).toBe('player_seat_unavailable')

    const stillAccepted = first.frames.filter((f) => f.frame === 'join-accepted')
    expect(stillAccepted).toHaveLength(1)
    expect(h.acceptedFor(first).token).toBe(firstAccepted.token)
  })

  it('accepts a spectator with seat null and a spectator-visible snapshot', () => {
    const h = harness()
    h.join(generateClientId(), 'player')
    const spec = h.join(generateClientId(), 'spectator')
    const accepted = h.acceptedFor(spec)
    expect(accepted.role).toBe('spectator')
    expect(accepted.seat).toBeNull()

    const snapshot = h.snapshotsFor(spec)[0]
    expect(snapshot.snapshot.visibility).toBe('spectator')
    expect(snapshot.snapshot.game.phase).toBe('awaiting-player')
  })

  it('host start-demo transitions to active and broadcasts demo-started', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const before = player.frames.length

    const result = h.controller.hostSubmit('start-demo')
    expect(result.accepted).toBe(true)

    const newFrames = player.frames.slice(before)
    expect(newFrames.some((f) => f.frame === 'broadcast-event' && f.event.type === 'demo-started')).toBe(true)
    const snapshot = newFrames.filter((f): f is SnapshotFrame => f.frame === 'snapshot')
    expect(snapshot[snapshot.length - 1].snapshot.game.phase).toBe('active')
    expect(snapshot[snapshot.length - 1].snapshot.game.activeSeat).toBe('host')
  })

  it('guest advance is rejected with not_active_seat when not the active seat', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const accepted = h.acceptedFor(player)
    h.controller.hostSubmit('start-demo')

    const before = player.frames.length
    h.sendIntent(player, {
      token: accepted.token,
      command: 'advance',
      idempotencyKey: 'a'.repeat(22),
      expectedEventSequence: 1,
    })
    const newFrames = player.frames.slice(before)
    const result = newFrames.find((f) => f.frame === 'command-result')
    expect(result && 'result' in result && result.result.accepted).toBe(false)
    expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe(
      'not_active_seat',
    )
    const snapshots = newFrames.filter((f): f is SnapshotFrame => f.frame === 'snapshot')
    expect(snapshots).toHaveLength(0)
  })

  it('host advance then guest advance round-trips state and sequence', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const accepted = h.acceptedFor(player)
    h.controller.hostSubmit('start-demo')
    h.controller.hostSubmit('advance')

    const before = player.frames.length
    h.sendIntent(player, {
      token: accepted.token,
      command: 'advance',
      idempotencyKey: 'b'.repeat(22),
      expectedEventSequence: 2,
    })
    const newFrames = player.frames.slice(before)
    const result = newFrames.find((f) => f.frame === 'command-result')
    expect(result && 'result' in result && result.result.accepted).toBe(true)
    const snapshots = newFrames.filter((f): f is SnapshotFrame => f.frame === 'snapshot')
    const latest = snapshots[snapshots.length - 1].snapshot
    expect(latest.eventSequence).toBe(3)
    expect(latest.game.activeSeat).toBe('host')
    expect(latest.game.units.find((u) => u.id === 'host-unit')?.integrity).toBe(2)
  })

  it('broadcasts both terminal events in order with the final completed snapshot', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const spectator = h.join(generateClientId(), 'spectator')
    const accepted = h.acceptedFor(player)
    h.controller.hostSubmit('start-demo')
    h.controller.hostSubmit('advance')
    h.sendIntent(player, { token: accepted.token, command: 'advance', idempotencyKey: 't'.repeat(22), expectedEventSequence: 2 })
    h.controller.hostSubmit('advance')
    h.sendIntent(player, { token: accepted.token, command: 'advance', idempotencyKey: 'u'.repeat(22), expectedEventSequence: 4 })

    const playerBefore = player.frames.length
    const spectatorBefore = spectator.frames.length
    const result = h.controller.hostSubmit('advance')
    expect(result.accepted).toBe(true)
    if (!result.accepted) return
    expect(result.event.type).toBe('action-confirmed')
    expect(result.event.eventSequence).toBe(6)
    expect(result.snapshot.eventSequence).toBe(7)
    expect(result.snapshot.game.phase).toBe('completed')
    expect(result.snapshot.game.winnerSeat).toBe('host')

    for (const frames of [player.frames.slice(playerBefore), spectator.frames.slice(spectatorBefore)]) {
      const events = frames
        .filter((frame) => frame.frame === 'broadcast-event')
        .map((frame) => frame.event)
      expect(events.map((event) => event.type)).toEqual(['action-confirmed', 'demo-completed'])
      expect(events.map((event) => event.eventSequence)).toEqual([6, 7])
      const snapshot = frames.filter((frame): frame is SnapshotFrame => frame.frame === 'snapshot').at(-1)
      expect(snapshot?.snapshot.game.phase).toBe('completed')
      expect(snapshot?.snapshot.eventSequence).toBe(7)
    }
  })

  it('replays an idempotency receipt without double settling', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const accepted = h.acceptedFor(player)
    h.controller.hostSubmit('start-demo')
    h.controller.hostSubmit('advance')

    const first = h.sendIntent(player, {
      token: accepted.token,
      command: 'advance',
      idempotencyKey: 'c'.repeat(22),
      expectedEventSequence: 2,
    })
    const firstResult = first.find((f) => f.frame === 'command-result')
    expect(firstResult && 'result' in firstResult && firstResult.result.accepted).toBe(true)

    const replay = h.sendIntent(player, {
      token: accepted.token,
      command: 'advance',
      idempotencyKey: 'c'.repeat(22),
      expectedEventSequence: 2,
    })
    const replayResult = replay.find((f) => f.frame === 'command-result')
    expect(replayResult && 'result' in replayResult && replayResult.result.accepted).toBe(true)

    // Let the host take its turn, then a fresh guest command proves replay did not settle twice.
    h.controller.hostSubmit('advance')
    const fresh = h.sendIntent(player, {
      token: accepted.token,
      command: 'advance',
      idempotencyKey: 'd'.repeat(22),
      expectedEventSequence: 4,
    })
    const freshSnapshot = fresh
      .filter((f): f is SnapshotFrame => f.frame === 'snapshot')
      .map((f) => f.snapshot)
    expect(freshSnapshot[freshSnapshot.length - 1].eventSequence).toBe(5)
    expect(freshSnapshot[freshSnapshot.length - 1].game.units.find((u) => u.id === 'host-unit')?.integrity).toBe(1)
  })

  it('rejects a stale expectedEventSequence with state_conflict and a fresh snapshot', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const accepted = h.acceptedFor(player)
    h.controller.hostSubmit('start-demo')
    h.controller.hostSubmit('advance')

    const frames = h.sendIntent(player, {
      token: accepted.token,
      command: 'advance',
      idempotencyKey: 'e'.repeat(22),
      expectedEventSequence: 0,
    })
    const result = frames.find((f) => f.frame === 'command-result')
    expect(result && 'result' in result && result.result.accepted).toBe(false)
    expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe(
      'state_conflict',
    )
    const snapshots = frames.filter((f): f is SnapshotFrame => f.frame === 'snapshot')
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].snapshot.eventSequence).toBe(2)
  })

  it('rejects a schema-invalid intent with protocol_invalid without settling', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const accepted = h.acceptedFor(player)

    const bad = {
      frame: 'command-intent' as const,
      protocolVersion: 1 as const,
      messageId: 'm-bad',
      roomId: h.roomId,
      clientId: accepted.clientId,
      token: accepted.token,
      intent: {
        protocolVersion: 1 as const,
        messageId: 'm-inner',
        roomId: h.roomId,
        senderClientId: accepted.clientId,
        kind: 'command-intent' as const,
        idempotencyKey: 'f'.repeat(22),
        expectedEventSequence: 0,
        command: { type: 'nonsense' },
      },
    }
    expect(player.client.send(bad as never)).toBe(true)
    const result = player.frames.find((f) => f.frame === 'command-result')
    expect(result && 'result' in result && result.result.accepted).toBe(false)
    expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe(
      'protocol_invalid',
    )
    expect(h.controller.hostSubmit('start-demo').accepted).toBe(true)
  })

  it('rejects a mismatched intent roomId with room_mismatch', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const accepted = h.acceptedFor(player)
    const frames = h.sendIntent(player, {
      token: accepted.token,
      command: 'start-demo',
      idempotencyKey: 'g'.repeat(22),
      expectedEventSequence: 0,
      intentRoomId: 'r_ZZZZZZZZZZZZ',
    })
    const result = frames.find((f) => f.frame === 'command-result')
    expect(result && 'result' in result && result.result.accepted).toBe(false)
    expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe(
      'room_mismatch',
    )
  })

  it('rejects spectator state commands with forbidden_role and does not settle', () => {
    const h = harness()
    h.join(generateClientId(), 'player')
    const spec = h.join(generateClientId(), 'spectator')
    const accepted = h.acceptedFor(spec)
    h.controller.hostSubmit('start-demo')

    for (const command of ['start-demo', 'advance'] as const) {
      const before = spec.frames.length
      h.sendIntent(spec, {
        token: accepted.token,
        command,
        idempotencyKey: `${command[0]}z`.padEnd(22, 'z'),
        expectedEventSequence: 1,
      })
      const newFrames = spec.frames.slice(before)
      const result = newFrames.find((f) => f.frame === 'command-result')
      expect(result && 'result' in result && result.result.accepted).toBe(false)
      expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe(
        'forbidden_role',
      )
      expect(newFrames.some((f) => f.frame === 'snapshot')).toBe(false)
    }
  })

  it('rejects an invalid token with identity_invalid', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    h.acceptedFor(player)
    const frames = h.sendIntent(player, {
      token: generateSessionToken(),
      command: 'start-demo',
      idempotencyKey: 'h'.repeat(22),
      expectedEventSequence: 0,
    })
    const result = frames.find((f) => f.frame === 'command-result')
    expect(result && 'result' in result && result.result.accepted).toBe(false)
    expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe(
      'identity_invalid',
    )
  })

  it('rejects a frame whose senderClientId does not match the bound clientId', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const accepted = h.acceptedFor(player)
    const frames = h.sendIntent(player, {
      token: accepted.token,
      command: 'start-demo',
      idempotencyKey: 'i'.repeat(22),
      expectedEventSequence: 0,
      intentSenderClientId: generateClientId(),
    })
    const result = frames.find((f) => f.frame === 'command-result')
    expect(result && 'result' in result && result.result.accepted).toBe(false)
    expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe(
      'identity_invalid',
    )
  })

  it('closes the older connection when the same clientId joins again and rebinds a new token', () => {
    const h = harness()
    const playerId = generateClientId()
    const first = h.join(playerId, 'player')
    const firstAccepted = h.acceptedFor(first)

    const second = h.join(playerId, 'player', null, firstAccepted.token)
    const secondAccepted = h.acceptedFor(second)
    expect(secondAccepted.token).not.toBe(firstAccepted.token)

    expect(first.client.status).toBe('duplicate_connection')
    expect(first.frames.some((f) => f.frame === 'duplicate-connection')).toBe(true)

    // 重连换发新令牌，旧令牌失效；角色授权仍然强制。
    const frames = h.sendIntent(second, {
      token: secondAccepted.token,
      command: 'start-demo',
      idempotencyKey: 'j'.repeat(22),
      expectedEventSequence: 0,
    })
    const result = frames.find((f) => f.frame === 'command-result')
    expect(result && 'result' in result && result.result.accepted).toBe(false)
    expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe('forbidden_role')
  })

  it('rebinds a reconnecting clientId to a fresh token and full snapshot', () => {
    const h = harness()
    const playerId = generateClientId()
    const first = h.join(playerId, 'player')
    const firstAccepted = h.acceptedFor(first)
    expect(h.controller.hostSubmit('start-demo').accepted).toBe(true)
    first.client.close()

    const second = h.join(playerId, 'player', null, firstAccepted.token)
    const accepted = h.acceptedFor(second)
    expect(accepted.seat).toBe('guest')
    const snapshot = h.snapshotsFor(second)[0]
    expect(snapshot.snapshot.game.phase).toBe('active')
    expect(snapshot.snapshot.eventSequence).toBe(1)
    expect(snapshot.snapshot.roster).toContainEqual({ clientId: playerId, seat: 'guest', role: 'player' })
  })

  it('explicit leave revokes the token while a pure network disconnect keeps it valid', () => {
    const h = harness()

    const explicit = h.join(generateClientId(), 'player')
    const explicitAccepted = h.acceptedFor(explicit)
    expect(
      explicit.client.send(leaveFrame(explicitAccepted.clientId, h.roomId, explicitAccepted.token)),
    ).toBe(true)
    expect(explicit.frames.filter((frame) => frame.frame === 'leave-accepted')).toHaveLength(1)
    expect(
      explicit.client.send(leaveFrame(explicitAccepted.clientId, h.roomId, explicitAccepted.token)),
    ).toBe(true)
    expect(explicit.frames.filter((frame) => frame.frame === 'leave-accepted')).toHaveLength(2)
    const stale = h.join(explicitAccepted.clientId, 'player', null, explicitAccepted.token)
    const rejected = stale.frames.find((f) => f.frame === 'join-rejected')
    expect(rejected && 'errorCode' in rejected ? rejected.errorCode : null).toBe('identity_invalid')

    const dropped = h.join(generateClientId(), 'player')
    const droppedAccepted = h.acceptedFor(dropped)
    dropped.client.close()
    const reconnected = h.join(droppedAccepted.clientId, 'player', null, droppedAccepted.token)
    expect(h.acceptedFor(reconnected).token).not.toBe(droppedAccepted.token)
  })

  it('broadcasts room-closed and ends the endpoint on closeRoom', () => {
    const h = harness()
    const player = h.join(generateClientId(), 'player')
    const spec = h.join(generateClientId(), 'spectator')

    h.controller.closeRoom()
    expect(h.controller.status).toBe('closed')
    expect(h.hostTransport.status).toBe('closed')
    for (const conn of [player, spec]) {
      expect(conn.frames.some((f) => f.frame === 'room-closed')).toBe(true)
    }

    const late = h.connect()
    expect(late.client.status).toBe('transport_unavailable')
  })
})

describe('host session against a transport that stays open after close', () => {
  class StickyHostTransport extends MemoryHostTransport {
    close(): void {
      // Keep routing so a command arriving after closeRoom can be exercised.
    }
  }

  function stickyHarness() {
    const hostTransport = new StickyHostTransport()
    const hostClientId = generateClientId()
    const controller = createHostSession({ hostTransport, hostClientId })
    const { roomId } = controller.createRoom()
    return { hostTransport, controller, roomId }
  }

  it('replies room_closed to commands that arrive after closeRoom', () => {
    const s = stickyHarness()
    const clientId = generateClientId()
    const client = connectMemoryClient(s.hostTransport)
    const frames: HostToClientFrame[] = []
    client.setEvents({ onStatus: () => {}, onFrame: (f) => frames.push(f) })
    client.connect(s.roomId)
    client.send(joinFrame(clientId, s.roomId, 'player'))
    const accepted = frames.find((f): f is JoinAcceptedFrame => f.frame === 'join-accepted')
    expect(accepted).toBeDefined()

    s.controller.closeRoom()
    expect(s.controller.status).toBe('closed')

    expect(
      client.send(
        intentFrame({
          roomId: s.roomId,
          clientId,
          token: (accepted as JoinAcceptedFrame).token,
          command: 'start-demo',
          idempotencyKey: 'k'.repeat(22),
          expectedEventSequence: 0,
        }),
      ),
    ).toBe(true)
    const result = frames.filter((f) => f.frame === 'command-result').at(-1)
    expect(result && 'result' in result && result.result.accepted).toBe(false)
    expect(result && 'result' in result && 'errorCode' in result.result ? result.result.errorCode : null).toBe(
      'room_closed',
    )
  })
})
