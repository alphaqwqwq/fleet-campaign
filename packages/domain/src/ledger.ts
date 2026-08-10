export type ReceiptKey = string

/**
 * 会话账本（无副作用纯数据结构）：由房主应用服务管理，
 * 为已接受命令分配严格递增的事件序列，并以 `clientId + idempotencyKey`
 * 保存命令收据，供重复键原样重放原结果。
 */
export interface SessionLedger<TReceipt> {
  sequence: number
  readonly receipts: ReadonlyMap<ReceiptKey, TReceipt>
}

export function createSessionLedger<TReceipt = never>(): SessionLedger<TReceipt> {
  return { sequence: 0, receipts: new Map() }
}

/** 接受一条新命令时分配下一个事件序列（严格递增，不修改原账本）。 */
export function advanceSequence<TReceipt>(
  ledger: SessionLedger<TReceipt>,
): SessionLedger<TReceipt> {
  return { ...ledger, sequence: ledger.sequence + 1 }
}

/** 记录命令收据；同一幂等键已存在时保留原收据，不覆盖、不重复结算。 */
export function recordReceipt<TReceipt>(
  ledger: SessionLedger<TReceipt>,
  key: ReceiptKey,
  receipt: TReceipt,
): SessionLedger<TReceipt> {
  if (ledger.receipts.has(key)) {
    return ledger
  }
  const receipts = new Map(ledger.receipts)
  receipts.set(key, receipt)
  return { ...ledger, receipts }
}

/** 查询既有收据；同一 `clientId + idempotencyKey` 永远映射同一结果。 */
export function lookupReceipt<TReceipt>(
  ledger: SessionLedger<TReceipt>,
  key: ReceiptKey,
): TReceipt | undefined {
  return ledger.receipts.get(key)
}

export function makeReceiptKey(clientId: string, idempotencyKey: string): ReceiptKey {
  return `${clientId}:${idempotencyKey}`
}
