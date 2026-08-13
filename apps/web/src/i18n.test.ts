import { describe, expect, it } from 'vitest'

import { messageKeyToI18nKey, translations, type I18nKey } from './i18n'

describe('i18n', () => {
  it('en defines every key present in zh', () => {
    for (const key of Object.keys(translations.zh)) {
      expect(translations.en[key as I18nKey], `missing en:${key}`).toBeDefined()
      expect(translations.en[key as I18nKey]).not.toBeUndefined()
    }
  })

  it('maps known protocol/join/save messageKeys to their own i18n keys', () => {
    const codes = [
      'protocol_invalid',
      'room_not_found',
      'forbidden_role',
      'state_conflict',
      'player_seat_unavailable',
      'save_invalid',
      'realtime.transport_unavailable',
    ]
    for (const code of codes) {
      expect(messageKeyToI18nKey(code)).toBe(`error.${code}`)
    }
  })

  it('falls back to the generic error key for unknown message keys', () => {
    expect(messageKeyToI18nKey('totally_unknown_code')).toBe('error.protocol_invalid')
  })
})
