import { randomUrlSafe } from '@fleet-campaign/realtime'

export function generateClientId(): string {
  return `u_${crypto.randomUUID()}`
}

export function generateRoomId(): string {
  // 5 位数字房间码（10000-99999，避免前导零便于口述/手动输入）。
  // 并发局数极少 + 局后释放，撞码概率可忽略；用普通随机即可，不承担密钥职责。
  return String(10000 + Math.floor(Math.random() * 90000))
}

export function generateCampaignId(): string {
  return `c_${crypto.randomUUID()}`
}

export function generateIdempotencyKey(): string {
  return randomUrlSafe(16)
}
