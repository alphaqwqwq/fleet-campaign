export const PROTOCOL_ERROR_CODES = [
  'protocol_invalid',
  'room_not_found',
  'room_mismatch',
  'identity_invalid',
  'forbidden_role',
  'state_conflict',
  'phase_mismatch',
  'not_active_seat',
  'command_invalid',
  'room_closed',
  'transport_unavailable',
] as const

export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number]

export function isProtocolErrorCode(value: unknown): value is ProtocolErrorCode {
  return typeof value === 'string' && (PROTOCOL_ERROR_CODES as readonly string[]).includes(value)
}
