import { describe, expect, it } from 'vitest'

import { connectMemoryClient, createMemoryHostTransport, MemoryClientTransport } from './memory'
import type { HostTransportEvents } from './connection'

const ROOM = '12345'

function joinRequest(clientId: string, messageId = 'm_1') {
  return {
    frame: 'join-request' as const,
    protocolVersion: 1 as const,
    messageId,
    roomId: ROOM,
    clientId,
    requestedRole: 'player' as const,
  }
}

function trackHost(host: ReturnType<typeof createMemoryHostTransport>, events: Partial<HostTransportEvents> = {}) {
  const received: { connectionId: string; frame: unknown }[] = []
  const connected: string[] = []
  const disconnected: string[] = []
  host.setEvents({
    onOpen: () => {},
    onClose: () => {},
    onClientConnect: (id) => connected.push(id),
    onClientDisconnect: (id) => disconnected.push(id),
    onFrame: (id, frame) => received.push({ connectionId: id, frame }),
    onUnavailable: () => {},
    ...events,
  })
  return { received, connected, disconnected }
}

function trackClient(client: MemoryClientTransport) {
  const statuses: string[] = []
  const frames: unknown[] = []
  client.setEvents({
    onStatus: (s) => statuses.push(s),
    onFrame: (f) => frames.push(f),
  })
  return { statuses, frames }
}

describe('memory transport doubles', () => {
  it('host opens and a client connects', () => {
    const host = createMemoryHostTransport()
    const { connected } = trackHost(host)
    host.open(ROOM)
    expect(host.status).toBe('open')
    expect(host.roomId).toBe(ROOM)

    const client = connectMemoryClient(host)
    const tracked = trackClient(client)
    client.connect(ROOM)
    expect(client.status).toBe('connected')
    expect(connected).toEqual([client.connectionId])
    expect(tracked.statuses).toContain('connected')
  })

  it('routes client frames to the host onFrame', () => {
    const host = createMemoryHostTransport()
    const { received } = trackHost(host)
    host.open(ROOM)
    const client = connectMemoryClient(host)
    trackClient(client)
    client.connect(ROOM)

    const frame = joinRequest('u_12345678-1234-4234-8234-123456789abc')
    expect(client.send(frame)).toBe(true)
    expect(received).toHaveLength(1)
    expect(received[0].connectionId).toBe(client.connectionId)
    expect(received[0].frame).toEqual(frame)
  })

  it('drops a schema-invalid client frame before application events', () => {
    const host = createMemoryHostTransport()
    const { received } = trackHost(host)
    host.open(ROOM)
    const client = connectMemoryClient(host)
    trackClient(client)
    client.connect(ROOM)
    expect(client.send(joinRequest('bad-client') as never)).toBe(false)
    expect(received).toHaveLength(0)
  })

  it('routes host frames back to the client', () => {
    const host = createMemoryHostTransport()
    trackHost(host)
    host.open(ROOM)
    const client = connectMemoryClient(host)
    const tracked = trackClient(client)
    client.connect(ROOM)

    const frame = { frame: 'room-closed' as const, protocolVersion: 1 as const, messageId: 'm_9', roomId: ROOM }
    expect(host.sendTo(client.connectionId, frame)).toBe(true)
    expect(tracked.frames).toEqual([frame])
  })

  it('host closes a client and the client observes disconnected', () => {
    const host = createMemoryHostTransport()
    const { disconnected } = trackHost(host)
    host.open(ROOM)
    const client = connectMemoryClient(host)
    const tracked = trackClient(client)
    client.connect(ROOM)

    host.closeClient(client.connectionId)
    expect(client.status).toBe('disconnected')
    expect(disconnected).toContain(client.connectionId)
    expect(tracked.statuses).toContain('disconnected')
  })

  it('host close ends all clients and the endpoint', () => {
    const host = createMemoryHostTransport()
    trackHost(host)
    host.open(ROOM)
    const c1 = connectMemoryClient(host)
    const c2 = connectMemoryClient(host)
    const t1 = trackClient(c1)
    const t2 = trackClient(c2)
    c1.connect(ROOM)
    c2.connect(ROOM)

    host.close()
    expect(host.status).toBe('closed')
    expect(c1.status).toBe('disconnected')
    expect(c2.status).toBe('disconnected')
    expect(t1.statuses).toContain('disconnected')
    expect(t2.statuses).toContain('disconnected')
  })

  it('duplicate-connection frame surfaces an observable terminal status', () => {
    const host = createMemoryHostTransport()
    trackHost(host)
    host.open(ROOM)
    const client = connectMemoryClient(host)
    const tracked = trackClient(client)
    client.connect(ROOM)

    const duplicate = {
      frame: 'duplicate-connection' as const,
      protocolVersion: 1 as const,
      messageId: 'm_7',
      roomId: ROOM,
      clientId: 'u_12345678-1234-4234-8234-123456789abc',
    }
    host.sendTo(client.connectionId, duplicate)
    host.closeClient(client.connectionId)
    expect(client.status).toBe('duplicate_connection')
    expect(tracked.statuses).toContain('duplicate_connection')
  })

  it('client connecting to a non-open host is transport_unavailable', () => {
    const host = createMemoryHostTransport()
    const client = connectMemoryClient(host)
    const tracked = trackClient(client)
    client.connect(ROOM)
    expect(client.status).toBe('transport_unavailable')
    expect(tracked.statuses).toContain('transport_unavailable')
  })

  it('send fails when the client is not connected', () => {
    const host = createMemoryHostTransport()
    host.open(ROOM)
    const client = connectMemoryClient(host)
    trackClient(client)
    expect(client.send(joinRequest('u_12345678-1234-4234-8234-123456789abc'))).toBe(false)
  })
})
