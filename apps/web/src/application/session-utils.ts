import { type GameState } from '@fleet-campaign/domain'
import {
  createCampaignPersistence,
  LocalStorageCampaignStore,
  type CampaignPersistence,
  type CampaignSave,
} from '@fleet-campaign/persistence'
import type { GameView, Snapshot } from '@fleet-campaign/protocol'
import {
  createClientPeerJsTransport,
  createHostPeerJsTransport,
  createRelayClientTransport,
  createRelayHostTransport,
  type ClientTransport,
  type HostTransport,
} from '@fleet-campaign/realtime'

import { generateClientId } from './ids'

const CLIENT_ID_KEY = 'fleet-campaign:clientId'
const TOKEN_KEY_PREFIX = 'fleet-campaign:token:'

/** 浏览器本地设备标识：首次生成并持久化，同一浏览器在多个临时房间复用。 */
export function getOrCreateClientId(): string {
  const existing = globalThis.localStorage?.getItem(CLIENT_ID_KEY)
  if (existing) return existing
  const id = generateClientId()
  globalThis.localStorage?.setItem(CLIENT_ID_KEY, id)
  return id
}

/** 重连令牌：仅存会话存储，供刷新后手动/有限重连。 */
export function readResumeToken(roomId: string): string | undefined {
  return globalThis.sessionStorage?.getItem(TOKEN_KEY_PREFIX + roomId) ?? undefined
}

export function writeResumeToken(roomId: string, token: string): void {
  globalThis.sessionStorage?.setItem(TOKEN_KEY_PREFIX + roomId, token)
}

export function clearResumeToken(roomId: string): void {
  globalThis.sessionStorage?.removeItem(TOKEN_KEY_PREFIX + roomId)
}

/**
 * 真实传输（ADR-005）：默认 Vercel 轮询中继（同源 /api/relay）；
 * 加 `?transport=peerjs` 查询参数可回退到 PeerJS 直连。
 */
function relayBaseUrl(): string {
  const origin = globalThis.location?.origin
  return origin ? `${origin}/api/relay` : ''
}

function transportMode(): 'relay' | 'peerjs' {
  return new URLSearchParams(globalThis.location?.search ?? '').get('transport') === 'peerjs' ? 'peerjs' : 'relay'
}

export function createHostTransport(): HostTransport {
  const mode = transportMode()
  if (mode === 'peerjs') {
    return createHostPeerJsTransport({ onOpen: () => {}, onClose: () => {}, onClientConnect: () => {}, onClientDisconnect: () => {}, onFrame: () => {}, onUnavailable: () => {} })
  }
  return createRelayHostTransport(
    { onOpen: () => {}, onClose: () => {}, onClientConnect: () => {}, onClientDisconnect: () => {}, onFrame: () => {}, onUnavailable: () => {} },
    { baseUrl: relayBaseUrl() },
  )
}

export function createClientTransport(): ClientTransport {
  const mode = transportMode()
  if (mode === 'peerjs') {
    return createClientPeerJsTransport({ onStatus: () => {}, onFrame: () => {} })
  }
  return createRelayClientTransport({ onStatus: () => {}, onFrame: () => {} }, { baseUrl: relayBaseUrl() })
}

/** 浏览器本地存档（IndexedDB 由 LocalStorageCampaignStore 经 StorageLike 注入）。 */
export function createPersistence(): CampaignPersistence {
  return createCampaignPersistence(new LocalStorageCampaignStore())
}

/** 由房主当前视图构建 demo-v1 存档载荷。 */
export function buildCampaignSave(campaignId: string, seed: string, snapshot: Snapshot | null): CampaignSave {
  if (!snapshot) throw new Error('save_invalid')
  return {
    schemaVersion: 1,
    campaignId,
    contentId: 'demo-v1',
    savedAt: new Date().toISOString(),
    gameSnapshot: snapshot.game,
    rngState: { seed, index: 0 },
    migrationMetadata: { migratedFrom: null },
  }
}

/** 从已校验存档的 GameView 重建领域状态（demo-v1，无私有状态）。 */
export function gameStateFromView(view: GameView): GameState {
  const host = view.units.find((unit) => unit.id === 'host-unit')
  const guest = view.units.find((unit) => unit.id === 'guest-unit')
  if (!host || !guest) throw new Error('save_invalid')
  return {
    contentId: 'demo-v1',
    phase: view.phase,
    round: view.round,
    activeSeat: view.activeSeat,
    actionPoints: view.actionPoints,
    units: [host, guest] as GameState['units'],
    winnerSeat: view.winnerSeat,
  }
}
