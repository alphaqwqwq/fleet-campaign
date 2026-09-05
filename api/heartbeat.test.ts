import { describe, expect, it } from 'vitest'

import { planHeartbeatWrite } from './heartbeat'

describe('planHeartbeatWrite', () => {
  it('produces host-open then host-close with a heartbeat marker', () => {
    const plan = planHeartbeatWrite(new Date('2026-08-14T06:00:00Z'))
    expect(plan.records).toEqual([
      { kind: 'host-open', secret: expect.any(String) },
      { kind: 'host-close' },
    ])
    expect(plan.roomId).toMatch(/^\d{5}$/)
    expect(plan.heartbeatKey).toBe('fc:heartbeat:last')
    expect(plan.heartbeatStamp).toBe('2026-08-14T06:00:00.000Z')
    expect(plan.heartbeatTtlSeconds).toBeGreaterThan(0)
  })

  it('orders open before the heartbeat marker before close', () => {
    const plan = planHeartbeatWrite()
    expect(plan.records[0].kind).toBe('host-open')
    expect(plan.records[1].kind).toBe('host-close')
    // 标记 key 独立于房间日志，且 TTL 远大于房间 1h TTL（供排障长期可见）。
    expect(plan.heartbeatKey).not.toContain(plan.roomId)
  })
})
