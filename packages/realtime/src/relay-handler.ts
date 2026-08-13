/**
 * Vercel 轮询中继的核心处理逻辑（ADR-005）。
 *
 * 每个房间一个追加式事件日志；房主/客机通过 HTTP 轮询读增量、POST 写记录。
 * 中继只存转发，不解析帧、不裁决规则；帧形状校验在两端适配器内完成。
 */

export interface RelayStore {
  /** 追加一条记录，返回追加后日志长度。 */
  append(roomId: string, record: unknown): Promise<number>
  /** 读取区间 [from, to]（含端点），to < from 时返回空数组。 */
  range(roomId: string, from: number, to: number): Promise<unknown[]>
  /** 当前日志长度。 */
  len(roomId: string): Promise<number>
  /** 清空该房间日志（释放房间码）。 */
  clear(roomId: string): Promise<void>
}

export interface RelayRequest {
  method: string
  roomId: string
  op: string
  query: Record<string, string | undefined>
  body: unknown
}

export interface RelayResponse {
  status: number
  body: unknown
}

const MAX_POLL_RECORDS = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 测试用的内存 store。 */
export function createMemoryRelayStore(): RelayStore {
  const logs = new Map<string, unknown[]>()
  return {
    async append(roomId, record): Promise<number> {
      const log = logs.get(roomId) ?? []
      log.push(record)
      logs.set(roomId, log)
      return log.length
    },
    async range(roomId, from, to): Promise<unknown[]> {
      const log = logs.get(roomId) ?? []
      if (to < from || from >= log.length) return []
      return log.slice(from, Math.min(to, log.length - 1) + 1)
    },
    async len(roomId): Promise<number> {
      return (logs.get(roomId) ?? []).length
    },
    async clear(roomId): Promise<void> {
      logs.delete(roomId)
    },
  }
}

export async function handleRelayRequest(request: RelayRequest, store: RelayStore): Promise<RelayResponse> {
  const { roomId, op, query } = request
  if (!roomId) return { status: 400, body: { error: 'room required' } }

  if (request.method === 'POST') {
    const body = isRecord(request.body) ? request.body : {}
    switch (op) {
      case 'host-open': {
        // 占据检查：存在未被 host-close 结束的 host-open 即视为房间占用。
        const total = await store.len(roomId)
        const existing = await store.range(roomId, 0, total - 1)
        let lastOpen = -1
        let lastClose = -1
        existing.forEach((record, index) => {
          if (isRecord(record)) {
            if (record.kind === 'host-open') lastOpen = index
            else if (record.kind === 'host-close') lastClose = index
          }
        })
        if (lastOpen > lastClose) return { status: 409, body: { error: 'room_occupied' } }
        // 复用房间码：清空旧日志，避免新房间继承上一场残留帧。
        await store.clear(roomId)
        await store.append(roomId, { kind: 'host-open' })
        return { status: 200, body: { ok: true } }
      }
      case 'host-send': {
        const frame = body.frame
        if (!isRecord(frame)) return { status: 400, body: { error: 'frame required' } }
        await store.append(roomId, { kind: 'to-guest', to: typeof body.to === 'string' ? body.to : null, frame })
        return { status: 200, body: { ok: true } }
      }
      case 'host-close':
        await store.append(roomId, { kind: 'host-close' })
        return { status: 200, body: { ok: true } }
      case 'host-close-client': {
        const connectionId = body.connectionId
        if (typeof connectionId !== 'string') return { status: 400, body: { error: 'connectionId required' } }
        await store.append(roomId, { kind: 'guest-leave', connectionId })
        return { status: 200, body: { ok: true } }
      }
      case 'guest-join': {
        const connectionId = body.connectionId
        if (typeof connectionId !== 'string') return { status: 400, body: { error: 'connectionId required' } }
        await store.append(roomId, { kind: 'guest-join', connectionId })
        return { status: 200, body: { ok: true } }
      }
      case 'guest-send': {
        const connectionId = body.connectionId
        const frame = body.frame
        if (typeof connectionId !== 'string' || !isRecord(frame)) {
          return { status: 400, body: { error: 'connectionId and frame required' } }
        }
        await store.append(roomId, { kind: 'frame', connectionId, frame })
        return { status: 200, body: { ok: true } }
      }
      case 'guest-leave': {
        const connectionId = body.connectionId
        if (typeof connectionId !== 'string') return { status: 400, body: { error: 'connectionId required' } }
        await store.append(roomId, { kind: 'guest-leave', connectionId })
        return { status: 200, body: { ok: true } }
      }
      default:
        return { status: 404, body: { error: 'unknown op' } }
    }
  }

  if (request.method === 'GET') {
    const since = Number(query.since ?? 0)
    if (op === 'host-poll') {
      const total = await store.len(roomId)
      const from = Math.min(Math.max(since, 0), total)
      const to = Math.min(from + MAX_POLL_RECORDS - 1, total - 1)
      const records = await store.range(roomId, from, to)
      return { status: 200, body: { records, cursor: from + records.length } }
    }
    if (op === 'guest-poll') {
      const connectionId = query.connectionId ?? ''
      const total = await store.len(roomId)
      const from = Math.min(Math.max(since, 0), total)
      const to = Math.min(from + MAX_POLL_RECORDS - 1, total - 1)
      const all = await store.range(roomId, from, to)
      const records = all.filter((record) => isRecord(record) && record.kind === 'to-guest' && (record.to === null || record.to === connectionId))
      return { status: 200, body: { records, cursor: from + all.length } }
    }
    return { status: 404, body: { error: 'unknown op' } }
  }

  return { status: 405, body: { error: 'method not allowed' } }
}
