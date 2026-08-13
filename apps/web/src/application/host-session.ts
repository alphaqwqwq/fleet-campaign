import { DEMO_V1_CONTENT } from '@fleet-campaign/content'
import { createInitialState, createSessionLedger, makeReceiptKey, recordReceipt, reduceCommand, type GameState, type SeatId } from '@fleet-campaign/domain'
import { isValidIdempotencyKey, projectGame, validateCommandIntent, type BroadcastEvent, type CommandIntent, type CommandResult, type ProtocolErrorCode, type Snapshot } from '@fleet-campaign/protocol'
import { generateSessionToken, randomUrlSafe, sessionTokenFingerprint, type ClientToHostFrame, type HostTransport } from '@fleet-campaign/realtime'

import { generateCampaignId, generateRoomId } from './ids'

type Role = 'host' | 'player' | 'spectator'
interface Binding { clientId: string; role: Role; seat: SeatId | null; tokenFingerprint: string; connectionId: string }
export type HostSessionStatus = 'starting' | 'open' | 'closed' | 'transport_unavailable'
export interface HostSessionOptions { hostTransport: HostTransport; hostClientId: string }

/** 房主侧只读视图，供 UI 渲染与存档构建使用。 */
export interface HostSessionView {
  status: HostSessionStatus
  roomId: string
  campaignId: string
  seed: string
  hasPlayer: boolean
  snapshot: Snapshot | null
  roster: Snapshot['roster']
}

/** Application composition for host authority. Transport frames are validated before reducer access. */
export class HostSessionController {
  public status: HostSessionStatus = 'starting'
  private roomId = ''
  private campaignId = ''
  private seed = ''
  private game: GameState | null = null
  private ledger = createSessionLedger<CommandResult>()
  private readonly bindings = new Map<string, Binding>()
  private readonly revokedTokens = new Map<string, string>()
  private hostCommandCounter = 0
  private readonly listeners = new Set<() => void>()

  public constructor(private readonly options: HostSessionOptions) {
    options.hostTransport.setEvents({
      onOpen: () => { this.status = 'open' },
      onClose: () => { if (this.status !== 'closed') this.status = 'closed' },
      onClientConnect: () => {},
      onClientDisconnect: (id) => {
        for (const binding of this.bindings.values()) {
          if (binding.connectionId === id) binding.connectionId = ''
        }
      },
      onFrame: (connectionId, frame) => this.receive(connectionId, frame),
      onUnavailable: () => { this.status = 'transport_unavailable' },
    })
  }

  public createRoom(): { roomId: string; campaignId: string } {
    const initial = createInitialState(DEMO_V1_CONTENT)
    if (!initial.ok) throw new Error('command_invalid')
    this.roomId = generateRoomId()
    this.campaignId = generateCampaignId()
    this.seed = randomUrlSafe(16)
    this.game = initial.state
    this.ledger = createSessionLedger()
    this.hostCommandCounter = 0
    const hostToken = generateSessionToken()
    this.bindings.set(this.options.hostClientId, { clientId: this.options.hostClientId, role: 'host', seat: 'host', tokenFingerprint: sessionTokenFingerprint(hostToken), connectionId: 'host' })
    this.options.hostTransport.open(this.roomId)
    this.changed()
    return { roomId: this.roomId, campaignId: this.campaignId }
  }

  public hostSubmit(command: 'start-demo' | 'advance'): CommandResult {
    const host = this.bindings.get(this.options.hostClientId)
    if (!host) throw new Error('room_not_found')
    this.hostCommandCounter += 1
    const key = `${command === 'start-demo' ? 's' : 'a'}${this.hostCommandCounter.toString(36)}`.padEnd(22, 'x')
    const result = this.handleIntent(host, { protocolVersion: 1, messageId: 'host-command', roomId: this.roomId, senderClientId: host.clientId, kind: 'command-intent', idempotencyKey: key, expectedEventSequence: this.ledger.sequence, command: { type: command } })
    this.changed()
    return result
  }

  /** 从已确认存档恢复对局：替换领域状态、种子与战役档，账本按新房间重建。 */
  public resume(state: GameState, seed: string, campaignId: string): void {
    if (this.status !== 'open') throw new Error('room_not_found')
    this.game = state
    this.seed = seed
    this.campaignId = campaignId
    this.ledger = createSessionLedger()
    this.changed()
  }

  /** 只读视图（房主可见性快照 + 名单 + 种子）。 */
  public getView(): HostSessionView {
    return {
      status: this.status,
      roomId: this.roomId,
      campaignId: this.campaignId,
      seed: this.seed,
      hasPlayer: [...this.bindings.values()].some((binding) => binding.role === 'player'),
      snapshot: this.game ? this.snapshot('host') : null,
      roster: [...this.bindings.values()].map((binding) => ({ clientId: binding.clientId, seat: binding.seat ?? 'guest', role: binding.role })),
    }
  }

  /** 订阅状态变更（创建/裁决/加入/离开/关闭/恢复）。 */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  public closeRoom(): void {
    if (this.status === 'closed') return
    this.status = 'closed'
    this.ledger = { ...this.ledger, sequence: this.ledger.sequence + 1 }
    if (this.game) this.game = { ...this.game, phase: 'closed', activeSeat: null, actionPoints: 0 }
    this.options.hostTransport.broadcast({ frame: 'broadcast-event', protocolVersion: 1, messageId: 'broadcast-event', roomId: this.roomId, event: { protocolVersion: 1, roomId: this.roomId, eventSequence: this.ledger.sequence, eventId: `e_${this.ledger.sequence}`, type: 'room-closed', publicPayload: {} } })
    this.options.hostTransport.broadcast({ frame: 'room-closed', protocolVersion: 1, messageId: 'room-closed', roomId: this.roomId })
    this.options.hostTransport.close()
    this.bindings.clear()
    this.revokedTokens.clear()
    this.changed()
  }

  private receive(connectionId: string, frame: ClientToHostFrame): void {
    if (frame.frame === 'join-request') { this.join(connectionId, frame); this.changed(); return }
    if (frame.frame === 'leave-request') { this.leave(connectionId, frame); this.changed(); return }
    const valid = validateCommandIntent(frame.intent)
    if (!valid.ok) { this.sendResult(connectionId, this.reject(this.safeIdempotencyKey(frame.intent?.idempotencyKey), frame.clientId, 'protocol_invalid')); return }
    if (frame.roomId !== this.roomId || valid.value.roomId !== this.roomId) {
      this.sendResult(connectionId, this.reject(valid.value.idempotencyKey, frame.clientId, 'room_mismatch'))
      return
    }
    if (this.status === 'closed') { this.sendResult(connectionId, this.reject(valid.value.idempotencyKey, frame.clientId, 'room_closed')); return }
    const binding = this.bindings.get(frame.clientId)
    if (!binding || binding.connectionId !== connectionId || binding.tokenFingerprint !== sessionTokenFingerprint(frame.token)) {
      this.sendResult(connectionId, this.reject(valid.value.idempotencyKey, frame.clientId, 'identity_invalid'))
      return
    }
    const result = this.handleIntent(binding, valid.value)
    this.sendResult(connectionId, result)
    if (!result.accepted && result.errorCode === 'state_conflict') this.sendSnapshot(connectionId, binding)
    this.changed()
  }

  private leave(connectionId: string, frame: Extract<ClientToHostFrame, { frame: 'leave-request' }>): void {
    const binding = this.bindings.get(frame.clientId)
    const fingerprint = sessionTokenFingerprint(frame.token)
    if (frame.roomId === this.roomId && !binding && this.revokedTokens.get(frame.clientId) === fingerprint) {
      this.sendLeaveAccepted(connectionId, frame.clientId)
      return
    }
    if (
      frame.roomId !== this.roomId
      || !binding
      || binding.connectionId !== connectionId
      || binding.tokenFingerprint !== fingerprint
    ) return
    this.bindings.delete(frame.clientId)
    this.revokedTokens.set(frame.clientId, fingerprint)
    this.sendLeaveAccepted(connectionId, frame.clientId)
  }

  private sendLeaveAccepted(connectionId: string, clientId: string): void {
    this.options.hostTransport.sendTo(connectionId, {
      frame: 'leave-accepted',
      protocolVersion: 1,
      messageId: 'leave-accepted',
      roomId: this.roomId,
      clientId,
    })
  }

  private safeIdempotencyKey(value: unknown): string {
    return isValidIdempotencyKey(value) ? value : '0000000000000000000000'
  }

  private join(connectionId: string, frame: Extract<ClientToHostFrame, { frame: 'join-request' }>): void {
    if (this.status !== 'open') { this.sendJoinRejected(connectionId, frame.clientId, 'transport_unavailable'); return }
    if (frame.roomId !== this.roomId) { this.sendJoinRejected(connectionId, frame.clientId, 'room_not_found'); return }
    const old = this.bindings.get(frame.clientId)
    if (old) {
      // 同一 clientId 返回：角色锁定，重新绑定连接并换发新令牌。
      // （ADR-001：临时令牌只降低误操作与角色混淆，不构成安全保证；
      //  relay 下连接可静默失效，令牌不得成为重连死结。）
      if (old.role !== frame.requestedRole) {
        this.sendJoinRejected(connectionId, frame.clientId, 'identity_invalid')
        return
      }
      if (old.connectionId && old.connectionId !== connectionId) {
        this.options.hostTransport.sendTo(old.connectionId, { frame: 'duplicate-connection', protocolVersion: 1, messageId: 'duplicate-connection', roomId: this.roomId, clientId: old.clientId })
        this.options.hostTransport.closeClient(old.connectionId)
      }
      old.connectionId = connectionId
      const reissuedToken = generateSessionToken()
      old.tokenFingerprint = sessionTokenFingerprint(reissuedToken)
      this.options.hostTransport.sendTo(connectionId, { frame: 'join-accepted', protocolVersion: 1, messageId: 'join-accepted', roomId: this.roomId, clientId: frame.clientId, token: reissuedToken, role: old.role, seat: old.seat })
      this.sendSnapshot(connectionId, old)
      return
    }
    if (frame.token !== undefined) { this.sendJoinRejected(connectionId, frame.clientId, 'identity_invalid'); return }
    if (frame.requestedRole === 'player' && [...this.bindings.values()].some((b) => b.role === 'player')) { this.sendJoinRejected(connectionId, frame.clientId, 'player_seat_unavailable'); return }
    const role: Role = frame.requestedRole
    const token = generateSessionToken()
    const binding: Binding = { clientId: frame.clientId, role, seat: role === 'spectator' ? null : 'guest', tokenFingerprint: sessionTokenFingerprint(token), connectionId }
    this.bindings.set(frame.clientId, binding)
    this.revokedTokens.delete(frame.clientId)
    this.options.hostTransport.sendTo(connectionId, { frame: 'join-accepted', protocolVersion: 1, messageId: 'join-accepted', roomId: this.roomId, clientId: frame.clientId, token, role, seat: binding.seat })
    this.sendSnapshot(connectionId, binding)
  }

  private handleIntent(binding: Binding, intent: CommandIntent): CommandResult {
    if (intent.roomId !== this.roomId) return this.reject(intent.idempotencyKey, binding.clientId, 'room_mismatch')
    if (intent.senderClientId !== binding.clientId) return this.reject(intent.idempotencyKey, binding.clientId, 'identity_invalid')
    if (binding.role === 'spectator') return this.reject(intent.idempotencyKey, binding.clientId, 'forbidden_role')
    if (intent.command.type === 'start-demo' && binding.role !== 'host') return this.reject(intent.idempotencyKey, binding.clientId, 'forbidden_role')
    const key = makeReceiptKey(binding.clientId, intent.idempotencyKey)
    const receipt = this.ledger.receipts.get(key)
    if (receipt) return receipt
    if (intent.expectedEventSequence !== this.ledger.sequence) return this.recordRejected(key, intent.idempotencyKey, binding.clientId, 'state_conflict')
    if (!this.game || (intent.command.type === 'start-demo' && ![...this.bindings.values()].some((b) => b.role === 'player'))) return this.recordRejected(key, intent.idempotencyKey, binding.clientId, 'command_invalid')
    const reduced = reduceCommand(this.game, { ...intent.command, actorSeat: binding.seat ?? 'guest' })
    if (reduced.kind === 'rejected') return this.recordRejected(key, intent.idempotencyKey, binding.clientId, reduced.rejection.code)
    this.game = reduced.state
    const events = reduced.events.map((event, index) => this.eventFor(event, this.ledger.sequence + index + 1))
    this.ledger = { ...this.ledger, sequence: this.ledger.sequence + events.length }
    const result: CommandResult = { protocolVersion: 1, messageId: 'command-result', roomId: this.roomId, senderClientId: binding.clientId, kind: 'command-result', idempotencyKey: intent.idempotencyKey, accepted: true, event: events[0], snapshot: this.snapshot(binding.role) }
    this.ledger = recordReceipt(this.ledger, key, result)
    for (const event of events) this.options.hostTransport.broadcast({ frame: 'broadcast-event', protocolVersion: 1, messageId: 'broadcast-event', roomId: this.roomId, event })
    this.syncSnapshots()
    return result
  }

  private snapshot(visibility: Role): Snapshot { return { protocolVersion: 1, roomId: this.roomId, campaignId: this.campaignId, eventSequence: this.ledger.sequence, game: projectGame(this.game as GameState), roster: [...this.bindings.values()].map((b) => ({ clientId: b.clientId, seat: b.seat ?? 'guest', role: b.role })), visibility } }
  private sendSnapshot(connectionId: string, binding: Binding): void { this.options.hostTransport.sendTo(connectionId, { frame: 'snapshot', protocolVersion: 1, messageId: 'snapshot', roomId: this.roomId, clientId: binding.clientId, snapshot: this.snapshot(binding.role) }) }
  private syncSnapshots(): void { for (const binding of this.bindings.values()) if (binding.connectionId && binding.connectionId !== 'host') this.sendSnapshot(binding.connectionId, binding) }
  private sendResult(connectionId: string, result: CommandResult): void { this.options.hostTransport.sendTo(connectionId, { frame: 'command-result', protocolVersion: 1, messageId: 'command-result', roomId: this.roomId, clientId: result.senderClientId, result }) }
  private sendJoinRejected(connectionId: string, clientId: string, errorCode: 'transport_unavailable' | 'room_not_found' | 'player_seat_unavailable' | 'identity_invalid'): void { this.options.hostTransport.sendTo(connectionId, { frame: 'join-rejected', protocolVersion: 1, messageId: 'join-rejected', roomId: this.roomId, clientId, errorCode, messageKey: errorCode }) }
  private recordRejected(key: string, idempotencyKey: string, senderClientId: string, errorCode: ProtocolErrorCode): CommandResult { const result = this.reject(idempotencyKey, senderClientId, errorCode); this.ledger = recordReceipt(this.ledger, key, result); return result }
  private reject(idempotencyKey: string, senderClientId: string, errorCode: ProtocolErrorCode): CommandResult { return { protocolVersion: 1, messageId: 'command-result', roomId: this.roomId, senderClientId, kind: 'command-result', idempotencyKey, accepted: false, errorCode, messageKey: errorCode, sequence: this.ledger.sequence } }
  private eventFor(event: { type: string; actorSeat: SeatId }, eventSequence: number): BroadcastEvent { const targetSeat = event.actorSeat === 'host' ? 'guest' : 'host'; const target = this.game?.units.find((u) => u.id === `${targetSeat}-unit`); if (event.type === 'demo-started') return { protocolVersion: 1, roomId: this.roomId, eventSequence, eventId: `e_${eventSequence}`, type: 'demo-started', actorSeat: event.actorSeat, publicPayload: { round: this.game?.round ?? 1, activeSeat: 'host' } }; if (event.type === 'demo-completed') return { protocolVersion: 1, roomId: this.roomId, eventSequence, eventId: `e_${eventSequence}`, type: 'demo-completed', actorSeat: event.actorSeat, publicPayload: { winnerSeat: event.actorSeat } }; return { protocolVersion: 1, roomId: this.roomId, eventSequence, eventId: `e_${eventSequence}`, type: 'action-confirmed', actorSeat: event.actorSeat, publicPayload: { targetSeat, targetIntegrity: target?.integrity ?? 0 } } }

  private changed(): void {
    for (const listener of this.listeners) listener()
  }
}

export function createHostSession(options: HostSessionOptions): HostSessionController { return new HostSessionController(options) }