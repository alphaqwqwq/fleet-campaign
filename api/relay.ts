import { kv } from '@vercel/kv'

import { handleRelayRequest, type RelayResponse, type RelayStore } from '../packages/realtime/src/relay-handler'

/**
 * Vercel 轮询中继函数（ADR-005）。无状态：房间帧日志存于 Vercel KV，
 * 按房间键追加式存储，读取带游标轮询；中继不解析帧、不裁决规则。
 */

const ROOM_KEY_PREFIX = 'fc:relay:'
const ROOM_TTL_SECONDS = 60 * 60

const store: RelayStore = {
  async append(roomId, record): Promise<number> {
    const key = ROOM_KEY_PREFIX + roomId
    const length = await kv.rpush(key, JSON.stringify(record))
    await kv.expire(key, ROOM_TTL_SECONDS)
    return length
  },
  async range(roomId, from, to): Promise<unknown[]> {
    if (to < from) return []
    const key = ROOM_KEY_PREFIX + roomId
    const items = await kv.lrange(key, from, to)
    return items.map((item) => JSON.parse(String(item)) as unknown)
  },
  async len(roomId): Promise<number> {
    return kv.llen(ROOM_KEY_PREFIX + roomId)
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
  const result: RelayResponse = await handleRelayRequest(
    { method: request.method ?? 'GET', roomId, op, query, body: request.body ?? null },
    store,
  )
  response.status(result.status).json(result.body)
}
