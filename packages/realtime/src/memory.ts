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
 * 无网络内存传输替身：客户端与房主在单一进程内通过直接调用路由帧，
 * 用于验证协议校验、角色拒绝、幂等重放、快照、重连、重复连接和房主关闭
 * 等确定性行为，不依赖 PeerJS/WebRTC 或公共信令。
 */
export class MemoryHostTransport implements HostTransport {
  status: HostStatus = 'starting'
  private events: HostTransportEvents | null = null
  private readonly clients = new Map<string, MemoryClientTransport>()
  private room: string | null = null

  setEvents(events: HostTransportEvents): void {
    this.events = events
  }

  open(roomId: string): void {
    this.room = roomId
    this.status = 'open'
    this.events?.onOpen()
  }

  get roomId(): string | null {
    return this.room
  }

  sendTo(connectionId: string, frame: HostToClientFrame): boolean {
    if (!validateOutboundFrame(frame).ok) return false
    const client = this.clients.get(connectionId)
    if (!client || client.status !== 'connected') return false
    client.receive(frame)
    return true
  }

  broadcast(frame: HostToClientFrame): void {
    if (!validateOutboundFrame(frame).ok) return
    for (const [connectionId, client] of [...this.clients]) {
      if (client.status === 'connected') this.sendTo(connectionId, frame)
    }
  }

  closeClient(connectionId: string): void {
    const client = this.clients.get(connectionId)
    if (!client) return
    this.clients.delete(connectionId)
    client.closeFromHost()
    this.events?.onClientDisconnect(connectionId)
  }

  close(): void {
    if (this.status === 'closed') return
    this.status = 'closed'
    for (const [, client] of [...this.clients]) client.closeFromHost()
    this.clients.clear()
    this.events?.onClose()
  }

  register(client: MemoryClientTransport): void {
    this.clients.set(client.connectionId, client)
    this.events?.onClientConnect(client.connectionId)
  }

  receive(connectionId: string, frame: ClientToHostFrame): boolean {
    if (this.status !== 'open') return false
    const client = this.clients.get(connectionId)
    if (!client || client.status !== 'connected') return false
    if (!validateInboundFrame(frame).ok) return false
    this.events?.onFrame(connectionId, frame)
    return true
  }

  unregister(connectionId: string): void {
    this.clients.delete(connectionId)
    this.events?.onClientDisconnect(connectionId)
  }
}

export class MemoryClientTransport implements ClientTransport {
  status: ClientStatus = 'idle'
  readonly connectionId: string
  private events: ClientTransportEvents | null = null
  private host: MemoryHostTransport | null

  constructor(host: MemoryHostTransport | null, connectionId: string) {
    this.host = host
    this.connectionId = connectionId
  }

  setEvents(events: ClientTransportEvents): void {
    this.events = events
    if (this.status === 'connected') this.events?.onStatus(this.status)
  }

  connect(roomId: string): void {
    void roomId
    this.status = 'connecting'
    this.events?.onStatus('connecting')
    const host = this.host
    if (!host || host.status !== 'open') {
      this.status = 'transport_unavailable'
      this.events?.onStatus('transport_unavailable')
      return
    }
    host.register(this)
    this.status = 'connected'
    this.events?.onStatus('connected')
  }

  send(frame: ClientToHostFrame): boolean {
    const host = this.host
    if (!host || this.status !== 'connected') return false
    return host.receive(this.connectionId, frame)
  }

  close(): void {
    if (this.status === 'closed' || this.status === 'duplicate_connection') return
    const host = this.host
    if (host) host.unregister(this.connectionId)
    this.status = 'closed'
    this.events?.onStatus('closed')
  }

  /** 房主侧关闭此连接时调用；`duplicate_connection` 终态不降级。 */
  closeFromHost(): void {
    if (this.status === 'closed' || this.status === 'duplicate_connection') return
    this.status = 'disconnected'
    this.events?.onStatus('disconnected')
  }

  /** 房主经 sendTo 下行帧时调用。 */
  receive(frame: HostToClientFrame): void {
    if (frame.frame === 'duplicate-connection') {
      this.status = 'duplicate_connection'
      this.events?.onStatus('duplicate_connection')
    }
    this.events?.onFrame(frame)
  }
}

/** 创建一个可接入多个客户连接的内存房主端点替身。 */
export function createMemoryHostTransport(events?: HostTransportEvents): MemoryHostTransport {
  const host = new MemoryHostTransport()
  if (events) host.setEvents(events)
  return host
}

/** 创建并接入房主端点的一个内存客户连接替身。 */
export function connectMemoryClient(
  host: MemoryHostTransport,
  events?: ClientTransportEvents,
): MemoryClientTransport {
  const connectionId = `cn_${MemoryClientTransportId.next()}`
  const client = new MemoryClientTransport(host, connectionId)
  if (events) client.setEvents(events)
  return client
}

const MemoryClientTransportId = {
  _n: 0,
  next(): string {
    this._n += 1
    return this._n.toString(36)
  },
}
