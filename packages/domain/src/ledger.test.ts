import { describe, expect, it } from 'vitest'

import {
  advanceSequence,
  createSessionLedger,
  lookupReceipt,
  makeReceiptKey,
  recordReceipt,
} from './index'

describe('SessionLedger', () => {
  it('starts at sequence 0 with no receipts', () => {
    const ledger = createSessionLedger<{ accepted: boolean }>()
    expect(ledger.sequence).toBe(0)
    expect(ledger.receipts.size).toBe(0)
  })

  it('advances the sequence strictly by one per call', () => {
    const ledger = createSessionLedger()
    expect(advanceSequence(ledger).sequence).toBe(1)
    expect(advanceSequence(advanceSequence(ledger)).sequence).toBe(2)
  })

  it('records and looks up a receipt by clientId + idempotencyKey', () => {
    const key = makeReceiptKey('u_client', 'key-1')
    const ledger = createSessionLedger<{ accepted: boolean }>()
    const recorded = recordReceipt(ledger, key, { accepted: true })
    expect(lookupReceipt(recorded, key)).toEqual({ accepted: true })
    expect(lookupReceipt(recorded, makeReceiptKey('u_client', 'other'))).toBeUndefined()
  })

  it('replays the original receipt for a repeated key without overriding', () => {
    const key = makeReceiptKey('u_client', 'key-1')
    const first = recordReceipt(createSessionLedger<{ accepted: boolean }>(), key, {
      accepted: true,
    })
    const second = recordReceipt(first, key, { accepted: false })
    expect(second.receipts.size).toBe(1)
    expect(lookupReceipt(second, key)).toEqual({ accepted: true })
  })

  it('keeps the original ledger unchanged on updates', () => {
    const key = makeReceiptKey('u_client', 'key-1')
    const ledger = createSessionLedger<{ accepted: boolean }>()
    const recorded = recordReceipt(ledger, key, { accepted: true })
    expect(ledger.receipts.size).toBe(0)
    expect(recorded.receipts.size).toBe(1)
    expect(ledger.sequence).toBe(0)
    expect(advanceSequence(ledger).sequence).toBe(1)
    expect(ledger.sequence).toBe(0)
  })
})
