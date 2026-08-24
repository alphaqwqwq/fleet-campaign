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
const SECRET = 'testsecret'
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
    host.open(ROOM, SECRET)

    const receivedByClient: HostToClientFrame[] = []
    const client: ClientTransport = createRelayClientTransport(
      { ...noopClientEvents, onFrame: (frame) => receivedByClient.push(frame) },
      transportOptions(fetchFn),
    )

    await waitFor(() => host.status === 'open', 'host open')
    client.connect(ROOM, SECRET)
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
    host.open(ROOM, SECRET)

    const receivedA: HostToClientFrame[] = []
    const receivedB: HostToClientFrame[] = []
    const clientA = createRelayClientTransport({ ...noopClientEvents, onFrame: (frame) => receivedA.push(frame) }, transportOptions(fetchFn))
    const clientB = createRelayClientTransport({ ...noopClientEvents, onFrame: (frame) => receivedB.push(frame) }, transportOptions(fetchFn))

    await waitFor(() => host.status === 'open', 'host open')
    clientA.connect(ROOM, SECRET)
    clientB.connect(ROOM, SECRET)
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
    host.open(ROOM, SECRET)
    await waitFor(() => host.status === 'open', 'host open')

    const invalid = { frame: 'not-a-frame', protocolVersion: 1 } as unknown as HostToClientFrame
    expect(host.sendTo('cn_x', invalid)).toBe(false)
    host.close()
  })

  it('rejects a second host with the wrong secret and frees the code on close', async () => {
    const store = createMemoryRelayStore()
    const fetchFn = createRelayFetch(store)
    const host = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host.open(ROOM, SECRET)
    await waitFor(() => host.status === 'open', 'first host open')

    // ADR-007：房间已占用时，携带错误口令的第二个房主被拒（403 → transport_unavailable）。
    const host2 = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host2.open(ROOM, 'wrong-secret')
    await waitFor(() => host2.status === 'transport_unavailable', 'second host rejected (wrong secret)')

    host.close()
    const host3 = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host3.open(ROOM, SECRET)
    await waitFor(() => host3.status === 'open', 'code freed and reopened')
    host3.close()
  })

  it('lets a host reclaim an occupied room with the correct secret (reconnect/reuse)', async () => {
    const store = createMemoryRelayStore()
    const fetchFn = createRelayFetch(store)
    const host = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host.open(ROOM, SECRET)
    await waitFor(() => host.status === 'open', 'first host open')

    // ADR-007：携带正确口令的房主可接管已占用房间（房主重连/换码复用）。
    const host2 = createRelayHostTransport(noopHostEvents, transportOptions(fetchFn))
    host2.open(ROOM, SECRET)
    await waitFor(() => host2.status === 'open', 'second host reclaimed with correct secret')
    host2.close()
  })

  it('delivers each frame exactly once even under slow (overlapping) polls', async () => {
    const store = createMemoryRelayStore()
    // 慢 fetch：每次请求 15ms，轮询 5ms → 强制轮询重叠。
    const baseFetch = createRelayFetch(store)
    const slowFetch: typeof globalThis.fetch = async (input, init) => {
      await new Promise((resolve) => setTimeout(resolve, 15))
      return baseFetch(input, init)
    }
    const opts = { baseUrl: 'http://relay.test/api/relay', fetchFn: slowFetch, pollIntervalMs: 5 }
    const received: HostToClientFrame[] = []
    const host: HostTransport = createRelayHostTransport(noopHostEvents, opts)
    host.open(ROOM, SECRET)
    const client: ClientTransport = createRelayClientTransport(
      { ...noopClientEvents, onFrame: (frame) => received.push(frame) },
      opts,
    )
    await waitFor(() => host.status === 'open', 'host open')
    client.connect(ROOM, SECRET)
    await waitFor(() => client.status === 'connected', 'client connected')

    const frame: HostToClientFrame = { frame: 'room-closed', protocolVersion: 1, messageId: 'm-close', roomId: ROOM }
    host.broadcast(frame)
    await waitFor(() => received.length >= 1, 'frame delivered')
    await new Promise((resolve) => setTimeout(resolve, 120))
    const deliveries = received.filter((f) => f.frame === 'room-closed')
    expect(deliveries.length).toBe(1)
    host.close()
    client.close()
  })
})

// ADR-007：房间口令鉴权。中继对每个房间的读写都要求携带房主签发的口令。
describe('relay room secret authorization (ADR-007)', () => {
  it('rejects host-open without a secret', async () => {
    const store = createMemoryRelayStore()
    const result = await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'host-open', query: {}, body: {} }, store)
    expect(result.status).toBe(400)
    expect(result.body).toEqual({ error: 'secret required' })
  })

  it('opens a room with a secret and rejects reads without it', async () => {
    const store = createMemoryRelayStore()
    const open = await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'host-open', query: {}, body: { secret: SECRET } }, store)
    expect(open.status).toBe(200)

    const pollNoSecret = await handleRelayRequest({ method: 'GET', roomId: ROOM, op: 'host-poll', query: { since: '0' }, body: null }, store)
    expect(pollNoSecret.status).toBe(403)
    expect(pollNoSecret.body).toEqual({ error: 'unauthorized' })
  })

  it('rejects reads with the wrong secret', async () => {
    const store = createMemoryRelayStore()
    await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'host-open', query: {}, body: { secret: SECRET } }, store)
    const pollWrong = await handleRelayRequest({ method: 'GET', roomId: ROOM, op: 'host-poll', query: { since: '0', secret: 'wrong' }, body: null }, store)
    expect(pollWrong.status).toBe(403)
    expect(pollWrong.body).toEqual({ error: 'unauthorized' })
  })

  it('allows reads and writes with the correct secret', async () => {
    const store = createMemoryRelayStore()
    await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'host-open', query: {}, body: { secret: SECRET } }, store)
    const poll = await handleRelayRequest({ method: 'GET', roomId: ROOM, op: 'host-poll', query: { since: '0', secret: SECRET }, body: null }, store)
    expect(poll.status).toBe(200)
    const send = await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'host-send', query: { secret: SECRET }, body: { to: null, frame: { frame: 'room-closed', protocolVersion: 1, messageId: 'm', roomId: ROOM } } }, store)
    expect(send.status).toBe(200)
  })

  it('returns room_not_found for a room that was never opened', async () => {
    const store = createMemoryRelayStore()
    const poll = await handleRelayRequest({ method: 'GET', roomId: '99999', op: 'host-poll', query: { since: '0', secret: SECRET }, body: null }, store)
    expect(poll.status).toBe(404)
    expect(poll.body).toEqual({ error: 'room_not_found' })
  })

  it('rejects guest operations without the secret', async () => {
    const store = createMemoryRelayStore()
    await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'host-open', query: {}, body: { secret: SECRET } }, store)
    const joinNoSecret = await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'guest-join', query: {}, body: { connectionId: 'cn_1' } }, store)
    expect(joinNoSecret.status).toBe(403)
    const joinWithSecret = await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'guest-join', query: { secret: SECRET }, body: { connectionId: 'cn_1' } }, store)
    expect(joinWithSecret.status).toBe(200)
  })

  it('frees the room after host-close and rejects further access as room_not_found', async () => {
    const store = createMemoryRelayStore()
    await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'host-open', query: {}, body: { secret: SECRET } }, store)
    await handleRelayRequest({ method: 'POST', roomId: ROOM, op: 'host-close', query: { secret: SECRET }, body: {} }, store)
    const poll = await handleRelayRequest({ method: 'GET', roomId: ROOM, op: 'host-poll', query: { since: '0', secret: SECRET }, body: null }, store)
    expect(poll.status).toBe(404)
    expect(poll.body).toEqual({ error: 'room_not_found' })
  })
})
