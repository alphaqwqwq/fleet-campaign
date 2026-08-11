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

/**
 * URL-safe 128-bit 随机键，由发起客户端以加密安全随机值生成并在重试时复用。
 * 采用无填充 base64url 编码 16 字节（22 字符），允许最长 32 字符；过短或过长的键一律拒绝。
 */
export function isValidIdempotencyKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 22 &&
    value.length <= 32 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  )
}
