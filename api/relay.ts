import { createClient, type RedisClientType } from 'redis'

import { handleRelayRequest, type RelayResponse, type RelayStore } from '../packages/realtime/src/relay-handler'

/**
 * Vercel 轮询中继函数（ADR-005）。无状态：房间帧日志存于 Vercel Redis
 * （`REDIS_URL`），按房间键追加式存储，读取带游标轮询；中继不解析帧、不裁决规则。
 */

const ROOM_KEY_PREFIX = 'fc:relay:'
const ROOM_TTL_SECONDS = 60 * 60

let cached: RedisClientType | undefined

function getClient(): RedisClientType {
  if (!cached) {
    cached = createClient({ url: process.env.REDIS_URL })
    // serverless 中避免未处理的 error 事件导致函数崩溃；错误经命令 Promise 抛给调用方。
    cached.on('error', () => {})
  }
  return cached
}

async function run<T>(fn: (client: RedisClientType) => Promise<T>): Promise<T> {
  const client = getClient()
  if (!client.isOpen) await client.connect()
  return fn(client)
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
  const query: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(request.query ?? {})) query[key] = single(value)
  const roomId = query.room ?? ''
  const op = query.op ?? ''
  try {
    const result: RelayResponse = await handleRelayRequest(
      { method: request.method ?? 'GET', roomId, op, query, body: request.body ?? null },
      store,
    )
    response.status(result.status).json(result.body)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'relay store failed' })
  }
}
