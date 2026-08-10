const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidMessageId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

export function isValidRoomId(value: unknown): value is string {
  return typeof value === 'string' && /^r_[A-Za-z0-9_-]{12}$/.test(value)
}

export function isValidCampaignId(value: unknown): value is string {
  return typeof value === 'string' && /^c_/.test(value) && UUID.test(value.slice(2))
}

export function isValidClientId(value: unknown): value is string {
  return typeof value === 'string' && /^u_/.test(value) && UUID.test(value.slice(2))
}

export function isValidEventId(value: unknown): value is string {
  return typeof value === 'string' && /^e_[A-Za-z0-9_-]{1,64}$/.test(value)
}

/** URL-safe 128-bit 随机键，最长 32 字符；由发起客户端生成并在重试时复用。 */
export function isValidIdempotencyKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 32 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  )
}
