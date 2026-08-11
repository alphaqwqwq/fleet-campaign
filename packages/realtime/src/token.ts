const BASE64_URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const TOKEN_PREFIX = 't_'
const TOKEN_RANDOM_BYTES = 32

/** 无填充 base64url 编码随机字节，供房间码、幂等键和会话令牌复用。 */
export function randomUrlSafe(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return toBase64UrlNoPad(bytes)
}

function toBase64UrlNoPad(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += BASE64_URL_ALPHABET[b0 >> 2]
    out += BASE64_URL_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]
    if (i + 1 < bytes.length) out += BASE64_URL_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]
    if (i + 2 < bytes.length) out += BASE64_URL_ALPHABET[b2 & 0x3f]
  }
  return out
}

/**
 * 会话令牌格式：`t_` 加 256-bit URL-safe 随机值（无填充 base64url 43 字符）。
 * 只保存在浏览器的会话存储与房主内存的令牌关联记录中，绝不放入 URL、日志、
 * 快照、导出包、旁白事实或错误文案。
 */
export function isValidSessionToken(value: unknown): value is string {
  return typeof value === 'string' && /^t_[A-Za-z0-9_-]{43}$/.test(value)
}

/** 房主签发与校验的本地临时会话令牌生成。 */
export function generateSessionToken(): string {
  return TOKEN_PREFIX + randomUrlSafe(TOKEN_RANDOM_BYTES)
}

/** 同步不可逆 verifier，房主绑定只保存摘要，不保存客机明文令牌。 */
export function sessionTokenFingerprint(token: string): string {
  const bytes = new TextEncoder().encode(token)
  let left = 0xcbf29ce484222325n
  let right = 0x84222325cbf29cen
  const prime = 0x100000001b3n
  const mask = (1n << 64n) - 1n
  for (const byte of bytes) {
    left = ((left ^ BigInt(byte)) * prime) & mask
    right = ((right ^ BigInt(byte + 1)) * prime) & mask
  }
  return `${left.toString(16).padStart(16, '0')}${right.toString(16).padStart(16, '0')}`
}

/** 房主只保存令牌摘要与房间/客户端/角色绑定，不保留客机明文令牌。 */
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return toBase64UrlNoPad(new Uint8Array(digest))
}
