import { validateDemoV1Content, type DemoV1Content } from '@fleet-campaign/content'

import type { GameState } from './types'

export type CreateInitialStateResult =
  | { ok: true; state: GameState }
  | { ok: false; errors: string[] }

/**
 * 通过显式内容输入创建初始领域状态（不能从 UI 或网络拉取内容）。
 * 内容未通过 demo-v1 校验时返回确定性错误，不产生半成品状态。
 */
export function createInitialState(content: DemoV1Content): CreateInitialStateResult {
  const validation = validateDemoV1Content(content)
  if (!validation.ok) {
    return { ok: false, errors: validation.errors }
  }

  const host = content.units.find((unit) => unit.id === 'host-unit')
  const guest = content.units.find((unit) => unit.id === 'guest-unit')
  if (!host || !guest) {
    return { ok: false, errors: ['content must provide both host-unit and guest-unit'] }
  }

  const state: GameState = {
    contentId: 'demo-v1',
    phase: 'awaiting-player',
    round: 0,
    activeSeat: null,
    actionPoints: 0,
    units: [
      { id: 'host-unit', integrity: host.integrity },
      { id: 'guest-unit', integrity: guest.integrity },
    ],
    winnerSeat: null,
  }
  return { ok: true, state }
}
