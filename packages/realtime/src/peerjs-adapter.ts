import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'

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

/**
 * 把 `roomId` 确定性映射为 PeerJS 端点 id。PeerJS 要求 id 以字母/数字开头结尾，
 * 中间只允许 `-`/`_`；`roomId` 末位可能是 `-`/`_`，故去掉末尾非字母数字并加 `fc` 前缀。
 * 两个仅在末尾非字母数字上有差异的 roomId 不会在同一进程中同时作为活跃端点。
 */
export function peerIdForRoom(roomId: string): string {
  const encoded = [...new TextEncoder().encode(roomId)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `fc-${encoded}`
}

/**
 * PeerJS/WebRTC 房主端点适配器：接受多条 DataConnection，经外向帧校验后透传。
 * 传输层不做规则结算、快照篡改或身份授权决策；所有下行帧按序可靠送达。
 */
export function createHostPeerJsTransport(initialEvents: HostTransportEvents): HostTransport {
  let events = initialEvents
  let status: HostStatus = 'starting'
  let peer: Peer | null = null
  const connections = new Map<string, DataConnection>()

  return {
    get status(): HostStatus {
      return status
    },
    setEvents(next: HostTransportEvents): void {
      events = next
    },
    open(roomId: string): void {
      if (status !== 'starting' || peer) return
      const id = peerIdForRoom(roomId)
      const p = new Peer(id, { debug: 0 })
      peer = p
      p.on('open', () => {
        status = 'open'
        events.onOpen()
      })
      p.on('connection', (conn: DataConnection) => {
        conn.on('open', () => {
          connections.set(conn.connectionId, conn)
          events.onClientConnect(conn.connectionId)
        })
        conn.on('data', (data: unknown) => {
          const frame = validateInboundFrame(data)
          if (!frame.ok) return
          events.onFrame(conn.connectionId, frame.value as ClientToHostFrame)
        })
        conn.on('close', () => {
          connections.delete(conn.connectionId)
          events.onClientDisconnect(conn.connectionId)
        })
        conn.on('error', () => {
          // PeerJS 在连接错误后随 close 事件收尾，交由 close 处理。
        })
      })
      p.on('error', (error) => {
        if (status !== 'closed') {
          status = 'transport_unavailable'
          events.onUnavailable(String(error.type))
        }
      })
      p.on('close', () => {
        status = 'closed'
        connections.clear()
        events.onClose()
      })
    },
    sendTo(connectionId: string, frame: HostToClientFrame): boolean {
      if (!validateOutboundFrame(frame).ok) return false
      const conn = connections.get(connectionId)
      if (!conn || !conn.open || status !== 'open') return false
      conn.send(frame)
      return true
    },
    broadcast(frame: HostToClientFrame): void {
      if (status !== 'open' || !validateOutboundFrame(frame).ok) return
      for (const conn of [...connections.values()]) {
        if (conn.open) conn.send(frame)
      }
    },
    closeClient(connectionId: string): void {
      const conn = connections.get(connectionId)
      if (!conn) return
      connections.delete(connectionId)
      conn.close()
    },
    close(): void {
      const p = peer
      peer = null
      connections.clear()
      if (p) p.destroy()
      status = 'closed'
      events.onClose()
    },
  }
}

/**
 * PeerJS/WebRTC 客户连接适配器：按 `roomId` 拨号房主端点，建立唯一可靠连接。
 * 断线后有限重连由应用服务通过重新 `connect` 驱动；本适配器不自动重放命令。
 */
export function createClientPeerJsTransport(initialEvents: ClientTransportEvents): ClientTransport {
  let events = initialEvents
  let status: ClientStatus = 'idle'
  let peer: Peer | null = null
  let conn: DataConnection | null = null
  let targetRoom: string | null = null

  function setStatus(next: ClientStatus): void {
    status = next
    events.onStatus(next)
  }

  return {
    get status(): ClientStatus {
      return status
    },
    setEvents(next: ClientTransportEvents): void {
      events = next
    },
    connect(roomId: string): void {
      conn?.close()
      peer?.destroy()
      conn = null
      peer = null
      targetRoom = roomId
      setStatus('connecting')
      const p = new Peer({ debug: 0 })
      peer = p
      p.on('open', () => {
        const c = p.connect(peerIdForRoom(targetRoom ?? roomId), {
          reliable: true,
          serialization: 'json',
        })
        conn = c
        c.on('open', () => setStatus('connected'))
        c.on('data', (data: unknown) => {
          const frame = validateOutboundFrame(data)
          if (frame.ok) events.onFrame(frame.value)
        })
        c.on('close', () => {
          if (status === 'connected') setStatus('disconnected')
        })
        c.on('error', () => {
          // 数据通道错误后由 close 事件收尾。
        })
      })
      p.on('error', () => {
        setStatus('transport_unavailable')
      })
      p.on('close', () => {
        // 销毁时不再触发状态。
      })
    },
    send(frame: ClientToHostFrame): boolean {
      if (!conn || !conn.open || status !== 'connected') return false
      conn.send(frame)
      return true
    },
    close(): void {
      conn?.close()
      const p = peer
      peer = null
      conn = null
      if (p) p.destroy()
      setStatus('closed')
    },
  }
}
