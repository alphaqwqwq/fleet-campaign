import type { BroadcastEvent } from '@fleet-campaign/protocol'

/** 把广播事件投影为简短的可读文本（仅作 UI 展示，不影响规则）。 */
export function describeEvent(event: BroadcastEvent): string {
  switch (event.type) {
    case 'demo-started':
      return `demo-started · round ${String(event.publicPayload.round)} · active ${String(event.publicPayload.activeSeat)}`
    case 'action-confirmed':
      return `action-confirmed · ${String(event.publicPayload.targetSeat)} integrity → ${String(event.publicPayload.targetIntegrity)}`
    case 'demo-completed':
      return `demo-completed · winner ${String(event.publicPayload.winnerSeat)}`
    case 'room-closed':
      return 'room-closed'
    default:
      return event.type
  }
}
