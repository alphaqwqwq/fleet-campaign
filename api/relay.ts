import { createClient, type RedisClientType } from 'redis'

/**
 * Vercel 轮询中继函数（ADR-005）。自包含：帧日志存于 Vercel Redis（REDIS_URL），
 * 按房间键追加式存储，读取带游标轮询。中继不解析帧、不裁决规则。
 *
 * 注意：本函数是自包含实现（handler 内联），与 packages/realtime 的
 * relay-handler.ts 保持逻辑一致；修改任何一处需同步另一处。
 */

const ROOM_KEY_PREFIX = 'fc:relay:'
const ROOM_TTL_SECONDS = 60 * 60
const MAX_POLL_RECORDS = 200

// ---------------------------------------------------------------------------
// Redis 存储（懒连接 + 复用，适配 serverless）
// ---------------------------------------------------------------------------

let cached: RedisClientType | undefined

function getClient(): RedisClientType {
  if (!cached) {
    cached = createClient({ url: process.env.REDIS_URL })
    cached.on('error', () => {})
  }
  return cached
}

async function run<T>(fn: (client: RedisClientType) => Promise<T>): Promise<T> {
  const client = getClient()
  if (!client.isOpen) await client.connect()
  return fn(client)
}

interface RelayStore {
  append(roomId: string, record: unknown): Promise<number>
  range(roomId: string, from: number, to: number): Promise<unknown[]>
  len(roomId: string): Promise<number>
}

const store: RelayStore = {
  async append(roomId, record): Promise<number> {
    const key = ROOM_KEY_PREFIX + roomId
    return run(async (client) => {
      const length = await client.rPush(key, JSON.stringify(record))
      await client.expire(key, ROOM_TTL_SECONDS)
      return length
    })
  },
  async range(roomId, from, to): Promise<unknown[]> {
    if (to < from) return []
    const key = ROOM_KEY_PREFIX + roomId
    return run(async (client) => {
      const items = await client.lRange(key, from, to)
      return items.map((item) => JSON.parse(String(item)) as unknown)
    })
  },
  async len(roomId): Promise<number> {
    return run(async (client) => client.lLen(ROOM_KEY_PREFIX + roomId))
  },
}

// ---------------------------------------------------------------------------
// 中继处理逻辑（与 packages/realtime/src/relay-handler.ts 保持一致）
// ---------------------------------------------------------------------------

interface RelayRequest {
  method: string
  roomId: string
  op: string
  query: Record<string, string | undefined>
  body: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function handleRelayRequest(request: RelayRequest, relayStore: RelayStore): Promise<{ status: number; body: unknown }> {
  const { roomId, op, query } = request
  if (!roomId) return { status: 400, body: { error: 'room required' } }

  if (request.method === 'POST') {
    const body = isRecord(request.body) ? request.body : {}
    switch (op) {
      case 'host-open':
        await relayStore.append(roomId, { kind: 'host-open' })
        return { status: 200, body: { ok: true } }
      case 'host-send': {
        const frame = body.frame
        if (!isRecord(frame)) return { status: 400, body: { error: 'frame required' } }
        await relayStore.append(roomId, { kind: 'to-guest', to: typeof body.to === 'string' ? body.to : null, frame })
        return { status: 200, body: { ok: true } }
      }
      case 'host-close':
        await relayStore.append(roomId, { kind: 'host-close' })
        return { status: 200, body: { ok: true } }
      case 'host-close-client': {
        const connectionId = body.connectionId
        if (typeof connectionId !== 'string') return { status: 400, body: { error: 'connectionId required' } }
        await relayStore.append(roomId, { kind: 'guest-leave', connectionId })
        return { status: 200, body: { ok: true } }
      }
      case 'guest-join': {
        const connectionId = body.connectionId
        if (typeof connectionId !== 'string') return { status: 400, body: { error: 'connectionId required' } }
        await relayStore.append(roomId, { kind: 'guest-join', connectionId })
        return { status: 200, body: { ok: true } }
      }
      case 'guest-send': {
        const connectionId = body.connectionId
        const frame = body.frame
        if (typeof connectionId !== 'string' || !isRecord(frame)) {
          return { status: 400, body: { error: 'connectionId and frame required' } }
        }
        await relayStore.append(roomId, { kind: 'frame', connectionId, frame })
        return { status: 200, body: { ok: true } }
      }
      case 'guest-leave': {
        const connectionId = body.connectionId
        if (typeof connectionId !== 'string') return { status: 400, body: { error: 'connectionId required' } }
        await relayStore.append(roomId, { kind: 'guest-leave', connectionId })
        return { status: 200, body: { ok: true } }
      }
      default:
        return { status: 404, body: { error: 'unknown op' } }
    }
  }

  if (request.method === 'GET') {
    const since = Number(query.since ?? 0)
    if (op === 'host-poll') {
      const total = await relayStore.len(roomId)
      const from = Math.min(Math.max(since, 0), total)
      const to = Math.min(from + MAX_POLL_RECORDS - 1, total - 1)
      const records = await relayStore.range(roomId, from, to)
      return { status: 200, body: { records, cursor: from + records.length } }
    }
    if (op === 'guest-poll') {
      const connectionId = query.connectionId ?? ''
      const total = await relayStore.len(roomId)
      const from = Math.min(Math.max(since, 0), total)
      const to = Math.min(from + MAX_POLL_RECORDS - 1, total - 1)
      const all = await relayStore.range(roomId, from, to)
      const records = all.filter((record) => isRecord(record) && record.kind === 'to-guest' && (record.to === null || record.to === connectionId))
      return { status: 200, body: { records, cursor: from + all.length } }
    }
    return { status: 404, body: { error: 'unknown op' } }
  }

  return { status: 405, body: { error: 'method not allowed' } }
}

// ---------------------------------------------------------------------------
// Vercel 入口
// ---------------------------------------------------------------------------

interface QueryRecord {
  [key: string]: string | string[] | undefined
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(
  request: { method?: string; query?: QueryRecord; body?: unknown },
  response: { status: (code: number) => { json: (payload: unknown) => void } },
): Promise<void> {
  if (!process.env.REDIS_URL) {
    response.status(500).json({ error: 'REDIS_URL not set on this deployment' })
    return
  }
  const query: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(request.query ?? {})) query[key] = single(value)
  const roomId = query.room ?? ''
  const op = query.op ?? ''
  try {
    const result = await handleRelayRequest(
      { method: request.method ?? 'GET', roomId, op, query, body: request.body ?? null },
      store,
    )
    response.status(result.status).json(result.body)
  } catch (error) {
    console.error('relay store failed', error)
    response.status(500).json({ error: error instanceof Error ? error.message : 'relay store failed' })
  }
}
