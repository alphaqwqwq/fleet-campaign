import type {
  ClientStatus,
  ClientTransport,
  ClientTransportEvents,
  HostStatus,
  HostTransport,
  HostTransportEvents,
} from './connection'
import type { ClientToHostFrame, HostToClientFrame } from './frames'
import { validateInboundFrame, validateOutboundFrame } from './frames-validate'
import { randomUrlSafe } from './token'

/**
 * Vercel 轮询中继传输适配器（ADR-005）。
 * 通过 HTTP 轮询读写房主/客机的帧日志；对外保持 `HostTransport`/`ClientTransport`
 * 事件接口不变。帧形状校验与其它适配器一致，在两端适配器内完成。
 */

export interface RelayTransportOptions {
  /** 中继函数完整 URL，如 `${origin}/api/relay`。 */
  baseUrl: string
  /** 轮询间隔（毫秒），默认 500。 */
  pollIntervalMs?: number
  /** 可注入 fetch（测试用），默认全局 fetch。 */
  fetchFn?: typeof globalThis.fetch
  /** 连续失败多少次后标记不可用，默认 3。 */
  maxFailures?: number
}

const DEFAULT_POLL_INTERVAL_MS = 500
const DEFAULT_MAX_FAILURES = 3

interface RelayJson {
  ok?: boolean
  records?: unknown[]
  cursor?: number
  error?: string
}

function buildUrl(baseUrl: string, roomId: string, op: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(baseUrl)
  url.searchParams.set('room', roomId)
  url.searchParams.set('op', op)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function relayRequest(
  fetchFn: typeof globalThis.fetch,
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<RelayJson> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const response = await fetchFn(url, init)
  if (!response.ok) throw new Error(`relay ${response.status}`)
  const data = (await response.json()) as RelayJson
  if (data.error) throw new Error(data.error)
  return data
}

function startPollLoop(
  options: RelayTransportOptions,
  poll: () => Promise<void>,
  onUnavailable: (reason: string) => void,
): () => void {
  const maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES
  const intervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  let timer: ReturnType<typeof setInterval> | null = null
  let stopped = false
  let inFlight = false
  let failures = 0

  const tick = async (): Promise<void> => {
    // 防并发：上一次 poll 未返回时跳过，否则同一批记录会被并发读取重复投递。
    if (stopped || inFlight) return
    inFlight = true
    try {
      await poll()
      failures = 0
    } catch (error) {
      failures += 1
      if (failures >= maxFailures) {
        onUnavailable(error instanceof Error ? error.message : String(error))
        stopped = true
        if (timer) clearInterval(timer)
      }
    } finally {
      inFlight = false
    }
  }

  void tick()
  timer = setInterval(() => {
    void tick()
  }, intervalMs)

  return () => {
    stopped = true
    if (timer) clearInterval(timer)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 房主端点：POST 开房，轮询拉取客机帧，POST 下发帧。 */
export function createRelayHostTransport(
  initialEvents: HostTransportEvents,
  options: RelayTransportOptions,
): HostTransport {
  const fetchFn = options.fetchFn ?? globalThis.fetch
  let events = initialEvents
  let status: HostStatus = 'starting'
  let roomId = ''
  let cursor = 0
  let stopPolling: (() => void) | null = null

  function request(
    method: 'GET' | 'POST',
    op: string,
    params: Record<string, string | number | undefined> = {},
    body?: unknown,
  ): Promise<RelayJson> {
    return relayRequest(fetchFn, buildUrl(options.baseUrl, roomId, op, params), method, body)
  }

  function handleRecord(record: unknown): void {
    if (!isRecord(record)) return
    if (record.kind === 'guest-join' && typeof record.connectionId === 'string') {
      events.onClientConnect(record.connectionId)
    } else if (record.kind === 'guest-leave' && typeof record.connectionId === 'string') {
      events.onClientDisconnect(record.connectionId)
    } else if (record.kind === 'frame') {
      const valid = validateInboundFrame(record.frame)
      if (valid.ok) events.onFrame(record.connectionId as string, valid.value as ClientToHostFrame)
    }
  }

  return {
    get status(): HostStatus {
      return status
    },
    setEvents(next: HostTransportEvents): void {
      events = next
    },
    open(nextRoomId: string): void {
      if (status !== 'starting') return
      roomId = nextRoomId
      void request('POST', 'host-open')
        .then(() => {
          if (status !== 'starting') return
          status = 'open'
          events.onOpen()
          stopPolling = startPollLoop(
            options,
            async () => {
              const data = await request('GET', 'host-poll', { since: cursor })
              for (const record of data.records ?? []) handleRecord(record)
              cursor = data.cursor ?? cursor
            },
            (reason) => {
              status = 'transport_unavailable'
              events.onUnavailable(reason)
            },
          )
        })
        .catch((error: unknown) => {
          if (status !== 'starting') return
          status = 'transport_unavailable'
          events.onUnavailable(error instanceof Error ? error.message : String(error))
        })
    },
    sendTo(connectionId: string, frame: HostToClientFrame): boolean {
      if (status !== 'open' || !validateOutboundFrame(frame).ok) return false
      void request('POST', 'host-send', {}, { to: connectionId, frame }).catch(() => {})
      return true
    },
    broadcast(frame: HostToClientFrame): void {
      if (status !== 'open' || !validateOutboundFrame(frame).ok) return
      void request('POST', 'host-send', {}, { to: null, frame }).catch(() => {})
    },
    closeClient(connectionId: string): void {
      void request('POST', 'host-close-client', {}, { connectionId }).catch(() => {})
    },
    close(): void {
      if (status === 'closed') return
      stopPolling?.()
      stopPolling = null
      void request('POST', 'host-close').catch(() => {})
      status = 'closed'
      events.onClose()
    },
  }
}

/** 客机连接：POST 加入，轮询拉取本连接的下行帧，POST 上行帧。 */
export function createRelayClientTransport(
  initialEvents: ClientTransportEvents,
  options: RelayTransportOptions,
): ClientTransport {
  const fetchFn = options.fetchFn ?? globalThis.fetch
  let events = initialEvents
  let status: ClientStatus = 'idle'
  let roomId = ''
  let connectionId = ''
  let cursor = 0
  let stopPolling: (() => void) | null = null

  function setStatus(next: ClientStatus): void {
    status = next
    events.onStatus(next)
  }

  function request(
    method: 'GET' | 'POST',
    op: string,
    params: Record<string, string | number | undefined> = {},
    body?: unknown,
  ): Promise<RelayJson> {
    return relayRequest(fetchFn, buildUrl(options.baseUrl, roomId, op, params), method, body)
  }

  return {
    get status(): ClientStatus {
      return status
    },
    setEvents(next: ClientTransportEvents): void {
      events = next
    },
    connect(nextRoomId: string): void {
      if (status !== 'idle' && status !== 'transport_unavailable') return
      roomId = nextRoomId
      connectionId = `cn_${randomUrlSafe(8)}`
      cursor = 0
      setStatus('connecting')
      void request('POST', 'guest-join', {}, { connectionId })
        .then(() => {
          if (status === 'closed') return
          setStatus('connected')
          stopPolling = startPollLoop(
            options,
            async () => {
              const data = await request('GET', 'guest-poll', { connectionId, since: cursor })
              for (const record of data.records ?? []) {
                if (isRecord(record) && record.kind === 'to-guest') {
                  const valid = validateOutboundFrame(record.frame)
                  if (valid.ok) events.onFrame(valid.value as HostToClientFrame)
                }
              }
              cursor = data.cursor ?? cursor
            },
            (reason) => {
              if (status !== 'closed') setStatus('transport_unavailable')
              void reason
            },
          )
        })
        .catch(() => {
          if (status !== 'closed') setStatus('transport_unavailable')
        })
    },
    send(frame: ClientToHostFrame): boolean {
      if (status !== 'connected' || !connectionId) return false
      void request('POST', 'guest-send', {}, { connectionId, frame }).catch(() => {})
      return true
    },
    close(): void {
      if (status === 'closed') return
      stopPolling?.()
      stopPolling = null
      if (connectionId && roomId) void request('POST', 'guest-leave', {}, { connectionId }).catch(() => {})
      setStatus('closed')
    },
  }
}
