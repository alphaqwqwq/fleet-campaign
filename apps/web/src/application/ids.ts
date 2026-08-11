import { randomUrlSafe } from '@fleet-campaign/realtime'

export function generateClientId(): string {
  return `u_${crypto.randomUUID()}`
}

export function generateRoomId(): string {
  return `r_${randomUrlSafe(9)}`
}

export function generateCampaignId(): string {
  return `c_${crypto.randomUUID()}`
}

export function generateIdempotencyKey(): string {
  return randomUrlSafe(16)
}
