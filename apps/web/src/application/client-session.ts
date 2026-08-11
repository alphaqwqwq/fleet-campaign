import type {
  CommandResult,
  ProtocolErrorCode,
  RosterRole,
  Snapshot,
} from '@fleet-campaign/protocol'
import type { SeatId } from '@fleet-campaign/domain'
import type {
  ClientStatus,
  ClientTransport,
  HostToClientFrame,
  JoinErrorCode,
  RequestedRole,
} from '@fleet-campaign/realtime'

export type ClientSessionStatus =
  | 'idle'
  | 'connecting'
  | 'joining'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'closed'
  | 'duplicate_connection'
  | 'transport_unavailable'

export interface ClientSessionError {
  code: JoinErrorCode | ProtocolErrorCode
  messageKey: string
}

export interface ClientSessionView {
  status: ClientSessionStatus
  role: RosterRole | null
  seat: SeatId | null
  snapshot: Snapshot | null
  lastResult: CommandResult | null
  lastError: ClientSessionError | null
}

export interface ClientSessionOptions {
  clientTransport: ClientTransport
  clientId: string
  createMessageId?: () => string
  resumeToken?: string
  onToken?: (token: string) => void
}

export class ClientSessionController {
  readonly view: ClientSessionView = {
    status: 'idle',
    role: null,
    seat: null,
    snapshot: null,
    lastResult: null,
    lastError: null,
  }

  private roomId = ''
  private requestedRole: RequestedRole = 'spectator'
  private token: string | null = null

  constructor(private readonly options: ClientSessionOptions) {
    this.token = options.resumeToken ?? null
    options.clientTransport.setEvents({
      onStatus: (status) => this.onTransportStatus(status),
      onFrame: (frame) => this.onFrame(frame),
    })
  }

  connect(roomId: string, role: RequestedRole): void {
    this.roomId = roomId
    this.requestedRole = role
    this.view.status = 'connecting'
    this.view.lastError = null
    this.options.clientTransport.connect(roomId)
  }

  reconnect(): void {
    if (!this.roomId || !this.token) {
      this.view.status = 'closed'
      this.view.lastError = { code: 'identity_invalid', messageKey: 'realtime.identity_invalid' }
      return
    }
    this.view.status = 'reconnecting'
    this.options.clientTransport.connect(this.roomId)
  }

  sendCommandIntent(command: 'start-demo' | 'advance', idempotencyKey: string): boolean {
    if (this.view.status !== 'connected' || !this.token || !this.view.snapshot) return false
    return this.options.clientTransport.send({
      frame: 'command-intent',
      protocolVersion: 1,
      messageId: this.messageId(),
      roomId: this.roomId,
      clientId: this.options.clientId,
      token: this.token,
      intent: {
        protocolVersion: 1,
        messageId: this.messageId(),
        roomId: this.roomId,
        senderClientId: this.options.clientId,
        kind: 'command-intent',
        idempotencyKey,
        expectedEventSequence: this.view.snapshot.eventSequence,
        command: { type: command },
      },
    })
  }

  close(): void {
    if (this.token && this.roomId && this.view.status === 'connected') {
      this.options.clientTransport.send({
        frame: 'leave-request',
        protocolVersion: 1,
        messageId: this.messageId(),
        roomId: this.roomId,
        clientId: this.options.clientId,
        token: this.token,
      })
    }
    this.options.clientTransport.close()
    this.token = null
    this.view.status = 'closed'
  }

  private sendJoin(): void {
    this.view.status = this.token ? 'reconnecting' : 'joining'
    this.options.clientTransport.send({
      frame: 'join-request',
      protocolVersion: 1,
      messageId: this.messageId(),
      roomId: this.roomId,
      clientId: this.options.clientId,
      requestedRole: this.requestedRole,
      ...(this.token ? { token: this.token } : {}),
    })
  }

  private onTransportStatus(status: ClientStatus): void {
    switch (status) {
      case 'connected':
        if (this.view.status === 'connecting' || this.view.status === 'reconnecting') this.sendJoin()
        break
      case 'duplicate_connection':
        this.view.status = 'duplicate_connection'
        break
      case 'transport_unavailable':
        this.view.status = 'transport_unavailable'
        this.view.lastError = { code: 'transport_unavailable', messageKey: 'realtime.transport_unavailable' }
        break
      case 'disconnected':
        if (this.view.status !== 'closed' && this.view.status !== 'duplicate_connection') {
          this.view.status = 'disconnected'
        }
        break
      case 'closed':
        if (this.view.status !== 'duplicate_connection') this.view.status = 'closed'
        break
      case 'connecting':
        if (this.view.status !== 'reconnecting') this.view.status = 'connecting'
        break
      default:
        break
    }
  }

  private onFrame(frame: HostToClientFrame): void {
    switch (frame.frame) {
      case 'join-accepted':
        if (frame.clientId !== this.options.clientId || frame.roomId !== this.roomId) return
        this.token = frame.token
        this.options.onToken?.(frame.token)
        this.view.role = frame.role
        this.view.seat = frame.seat
        this.view.status = 'connected'
        this.view.lastError = null
        break
      case 'join-rejected':
        this.view.status = frame.errorCode === 'transport_unavailable' ? 'transport_unavailable' : 'closed'
        this.view.lastError = { code: frame.errorCode, messageKey: frame.messageKey }
        break
      case 'snapshot':
        if (frame.clientId === this.options.clientId) this.view.snapshot = frame.snapshot
        break
      case 'command-result':
        if (frame.clientId !== this.options.clientId) return
        this.view.lastResult = frame.result
        this.view.lastError = frame.result.accepted
          ? null
          : { code: frame.result.errorCode, messageKey: frame.result.messageKey }
        break
      case 'duplicate-connection':
        if (frame.clientId === this.options.clientId) this.view.status = 'duplicate_connection'
        break
      case 'room-closed':
        this.view.status = 'closed'
        this.token = null
        break
      case 'broadcast-event':
        break
    }
  }

  private messageId(): string {
    return (this.options.createMessageId ?? (() => crypto.randomUUID()))()
  }
}

export function createClientSession(options: ClientSessionOptions): ClientSessionController {
  return new ClientSessionController(options)
}
