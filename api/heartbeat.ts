import { createClient, type RedisClientType } from 'redis'

/**
 * 保活 / 心跳函数（Vercel Cron 驱动）。
 *
 * 背景：Vercel 官方 Redis 免费档会因"无近期活动"自动删除数据库（fleet-relay）。
 * relay 只在有人开房/联机时才写 Redis，平时无写入 → 有被删风险。
 *
 * 本函数由 vercel.json 的 crons 每天调用一次，向 Redis 写入真实数据：
 *   1. 用专用心跳房间码执行一次 host-open（写 `fc:relay:<room>` 记录，带 1h TTL）；
 *   2. 写 `fc:heartbeat:last` 标记（时间戳，长 TTL）供排障确认数据库确实有活动；
 *   3. host-close 收尾。
 *
 * 自包含（不跨包导入），与 api/relay.ts 共用同一 Redis key 前缀与记录形状，
 * 但不依赖 relay 路由——直接操作 store，保证 cron 与 Redis 同环境、不经过公网。
 */

const ROOM_KEY_PREFIX = 'fc:relay:'
const ROOM_TTL_SECONDS = 60 * 60
const HEARTBEAT_KEY = 'fc:heartbeat:last'
const HEARTBEAT_TTL_SECONDS = 90 * 24 * 60 * 60 // 90 天

/** 专用心跳房间码：避开真实随机房号（10000-99999）的高频区，可用环境变量覆盖。 */
const HEARTBEAT_ROOM_ID = process.env.HEARTBEAT_ROOM_ID ?? '90999'
/** 心跳房间口令：仅用于 relay 记录完整性，非密钥。 */
const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET ?? 'heartbeat'

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

async function append(roomId: string, record: unknown): Promise<void> {
  const key = ROOM_KEY_PREFIX + roomId
  await run(async (client) => {
    await client.rPush(key, JSON.stringify(record))
    await client.expire(key, ROOM_TTL_SECONDS)
  })
}

/** 中继记录形状：与 api/relay.ts 的 host-open / host-close 保持一致。 */
export interface HeartbeatWrite {
  roomId: string
  records: { kind: 'host-open' | 'host-close'; secret?: string }[]
  heartbeatStamp: string
  heartbeatKey: string
  heartbeatTtlSeconds: number
}

/** 心跳写入的确定性计划：开房记录 + 心跳标记 + 关房记录（测试友好，纯数据）。 */
export function planHeartbeatWrite(now = new Date()): HeartbeatWrite {
  return {
    roomId: HEARTBEAT_ROOM_ID,
    records: [
      { kind: 'host-open', secret: HEARTBEAT_SECRET },
      { kind: 'host-close' },
    ],
    heartbeatStamp: now.toISOString(),
    heartbeatKey: HEARTBEAT_KEY,
    heartbeatTtlSeconds: HEARTBEAT_TTL_SECONDS,
  }
}

async function heartbeatWrite(): Promise<void> {
  const plan = planHeartbeatWrite()
  for (const record of plan.records) {
    await append(plan.roomId, record)
  }
  await run(async (client) => {
    await client.set(plan.heartbeatKey, plan.heartbeatStamp)
    await client.expire(plan.heartbeatKey, plan.heartbeatTtlSeconds)
  })
}

/** Cron 鉴权：设置了 CRON_SECRET 时，Vercel 会在 cron 请求自动带 Authorization: Bearer <CRON_SECRET>。 */
function authorized(request: { headers?: Record<string, string | string[] | undefined> }): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const auth = request.headers?.authorization
  const value = Array.isArray(auth) ? auth[0] : auth
  return value === `Bearer ${expected}`
}

export default async function handler(
  request: { headers?: Record<string, string | string[] | undefined> },
  response: { status: (code: number) => { json: (payload: unknown) => void } },
): Promise<void> {
  if (!process.env.REDIS_URL) {
    response.status(500).json({ error: 'REDIS_URL not set on this deployment' })
    return
  }
  if (!authorized(request)) {
    response.status(403).json({ error: 'unauthorized' })
    return
  }
  try {
    await heartbeatWrite()
    response.status(200).json({ ok: true, room: HEARTBEAT_ROOM_ID, at: new Date().toISOString() })
  } catch (error) {
    console.error('heartbeat failed', error)
    response.status(500).json({ error: error instanceof Error ? error.message : 'heartbeat failed' })
  }
}
