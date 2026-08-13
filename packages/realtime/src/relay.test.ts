import { describe, expect, it } from 'vitest'

import type { ClientTransport, HostTransport } from './connection'
import type { ClientToHostFrame, HostToClientFrame } from './frames'
import { createMemoryRelayStore, handleRelayRequest } from './relay-handler'
import { createRelayClientTransport, createRelayHostTransport, type RelayTransportOptions } from './relay'
import { generateSessionToken } from './token'

// 把适配器的 fetch 调用路由到内存中继处理器，验证轮询传输全链路，无需真实网络。
function createRelayFetch(store: ReturnType<typeof createMemoryRelayStore>): typeof globalThis.fetch {
  return async (input, init) => {
    const url = new URL(String(input))
    const query: Record<string, string | undefined> = {}
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })
    let body: unknown = null
    if (init?.body) body = JSON.parse(String(init.body)) as unknown
    const result = await handleRelayRequest(
      {
        method: init?.method ?? 'GET',
        roomId: url.searchParams.get('room') ?? '',
        op: url.searchParams.get('op') ?? '',
        query,
        body,
      },
      store,
    )
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function transportOptions(fetchFn: typeof globalThis.fetch): RelayTransportOptions {
  return { baseUrl: 'http://relay.test/api/relay', fetchFn, pollIntervalMs: 5 }
}

const noopHostEvents = {
  onOpen: () => {},
  onClose: () => {},
  onClientConnect: () => {},
  onClientDisconnect: () => {},
  onFrame: () => {},
  onUnavailable: () => {},
}

const noopClientEvents = { onStatus: () => {}, onFrame: () => {} }

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

const ROOM = '12345'
const CLIENT_ID = 'u_00000000-0000-4000-8000-000000000001'

function joinFrame(): ClientToHostFrame {
  return { frame: 'join-request', protocolVersion: 1, messageId: 'm-join', roomId: ROOM, clientId: CLIENT_ID, requestedRole: 'player' }
}

function acceptedFrame(): HostToClientFrame {
  return { frame: 'join-accepted', protocolVersion: 1, messageId: 'm-acc', roomId: ROOM, clientId: CLIENT_ID, token: generateSessionToken(), role: 'player', seat: 'guest' }
}

describe('relay polling transport', () => {
  it('routes client frames to the host and host frames back to the client', async () => {
    const store = createMemoryRelayStore()
    const fetchFn = createRelayFetch(store)
    const receivedByHost: { connectionId: string; frame: ClientToHostFrame }[] = []
    const host: HostTransport = createRelayHostTransport(
      { ...noopHostEvents, onFrame: (connectionId, frame) => receivedByHost.push({ connectionId, frame }) },
      transportOptions(fetchFn),
    )
    host.open(ROOM)

    const receivedByClient: HostToClientFrame[] = []
    const client: ClientTransport = createRelayClientTransport(
      { ...noopClientEvents, onFrame: (frame) => receivedByClient.push(frame) },
      transportOptions(fetchFn),
    )

    await waitFor(() => host.status === 'open', 'host open')
    client.connect(ROOM)
    await waitFor(() => client.status === 'connected', 'client connected')

    expect(client.send(joinFrame())).toBe(true)
    await waitFor(() => receivedByHost.some((entry) => entry.frame.frame === 'join-request'), 'host got join')

    const accepted = acceptedFrame()
    host.sendTo(receivedByHost[0].connectionId, accepted)
    await waitFor(() => receivedByClient.some((frame) => frame.frame === 'join-accepted'), 'client got accepted')
    expect(receivedByClient).toContainEqual(accepted)

    host.close()
    client.close()
  })

  it('delivers broadcast frames to every connected guest', async () => {
    const store = createMemoryRelayStore()
    const fetchFn = createRelayFetch(store)
    const host: HostTransport = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host.open(ROOM)

    const receivedA: HostToClientFrame[] = []
    const receivedB: HostToClientFrame[] = []
    const clientA = createRelayClientTransport({ ...noopClientEvents, onFrame: (frame) => receivedA.push(frame) }, transportOptions(fetchFn))
    const clientB = createRelayClientTransport({ ...noopClientEvents, onFrame: (frame) => receivedB.push(frame) }, transportOptions(fetchFn))

    await waitFor(() => host.status === 'open', 'host open')
    clientA.connect(ROOM)
    clientB.connect(ROOM)
    await waitFor(() => clientA.status === 'connected' && clientB.status === 'connected', 'clients connected')

    const frame: HostToClientFrame = { frame: 'room-closed', protocolVersion: 1, messageId: 'm-close', roomId: ROOM }
    host.broadcast(frame)
    await waitFor(
      () => receivedA.some((f) => f.frame === 'room-closed') && receivedB.some((f) => f.frame === 'room-closed'),
      'broadcast delivered',
    )
    host.close()
    clientA.close()
    clientB.close()
  })

  it('refuses frames that fail outbound validation', async () => {
    const store = createMemoryRelayStore()
    const fetchFn = createRelayFetch(store)
    const host: HostTransport = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host.open(ROOM)
    await waitFor(() => host.status === 'open', 'host open')

    const invalid = { frame: 'not-a-frame', protocolVersion: 1 } as unknown as HostToClientFrame
    expect(host.sendTo('cn_x', invalid)).toBe(false)
    host.close()
  })

  it('rejects a second host on an occupied room and frees the code on close', async () => {
    const store = createMemoryRelayStore()
    const fetchFn = createRelayFetch(store)
    const host = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host.open(ROOM)
    await waitFor(() => host.status === 'open', 'first host open')

    const host2 = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host2.open(ROOM)
    await waitFor(() => host2.status === 'transport_unavailable', 'second host rejected as occupied')

    host.close()
    const host3 = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host3.open(ROOM)
    await waitFor(() => host3.status === 'open', 'code freed and reopened')
    host3.close()
  })
})
