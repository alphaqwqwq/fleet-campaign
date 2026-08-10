import { describe, expect, it } from 'vitest'

import { DEMO_V1_CONTENT } from '@fleet-campaign/content'

import { checkInvariants, createInitialState, reduceCommand } from './index'
import type { DomainCommand, DomainEvent, GameState } from './types'

function initialGame(): GameState {
  const result = createInitialState(DEMO_V1_CONTENT)
  if (!result.ok) throw new Error('demo-v1 fixture must be valid')
  return result.state
}

function expectInvariantsHold(state: GameState): void {
  expect(checkInvariants(state)).toEqual([])
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key])
    Object.freeze(value)
  }
  return value
}

describe('createInitialState', () => {
  it('builds the awaiting-player baseline', () => {
    const state = initialGame()
    expect(state).toEqual({
      contentId: 'demo-v1',
      phase: 'awaiting-player',
      round: 0,
      activeSeat: null,
      actionPoints: 0,
      units: [
        { id: 'host-unit', integrity: 3 },
        { id: 'guest-unit', integrity: 3 },
      ],
      winnerSeat: null,
    })
    expectInvariantsHold(state)
  })

  it('rejects content that fails demo-v1 validation', () => {
    const result = createInitialState({ ...DEMO_V1_CONTENT, actionPoints: 2 })
    expect(result.ok).toBe(false)
  })
})

describe('start-demo', () => {
  it('transitions awaiting-player to active with host as first actor', () => {
    const result = reduceCommand(initialGame(), { type: 'start-demo', actorSeat: 'host' })
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    expect(result.state.phase).toBe('active')
    expect(result.state.round).toBe(1)
    expect(result.state.activeSeat).toBe('host')
    expect(result.state.actionPoints).toBe(1)
    expect(result.events).toEqual([
      { type: 'demo-started', actorSeat: 'host', rngIndex: 0, round: 1, activeSeat: 'host' },
    ])
    expectInvariantsHold(result.state)
  })

  it('rejects start-demo from a non-host seat with command_invalid', () => {
    const result = reduceCommand(initialGame(), { type: 'start-demo', actorSeat: 'guest' })
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('command_invalid')
  })

  it('rejects a second start-demo with phase_mismatch', () => {
    const started = reduceCommand(initialGame(), { type: 'start-demo', actorSeat: 'host' })
    if (started.kind !== 'accepted') throw new Error('first start-demo must succeed')
    const result = reduceCommand(started.state, { type: 'start-demo', actorSeat: 'host' })
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('phase_mismatch')
  })
})

describe('advance', () => {
  it('rotates host -> guest without advancing the round', () => {
    const started = reduceCommand(initialGame(), { type: 'start-demo', actorSeat: 'host' })
    if (started.kind !== 'accepted') throw new Error('start-demo must succeed')
    const result = reduceCommand(started.state, { type: 'advance', actorSeat: 'host' })
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    expect(result.state.round).toBe(1)
    expect(result.state.activeSeat).toBe('guest')
    expect(result.state.actionPoints).toBe(1)
    expect(result.state.units.find((u) => u.id === 'guest-unit')?.integrity).toBe(2)
    expect(result.events).toEqual([
      { type: 'action-confirmed', actorSeat: 'host', rngIndex: 0, targetSeat: 'guest', targetIntegrity: 2 },
    ])
    expectInvariantsHold(result.state)
  })

  it('rotates guest -> host and advances the round', () => {
    const started = reduceCommand(initialGame(), { type: 'start-demo', actorSeat: 'host' })
    if (started.kind !== 'accepted') throw new Error('start-demo must succeed')
    const hostHit = reduceCommand(started.state, { type: 'advance', actorSeat: 'host' })
    if (hostHit.kind !== 'accepted') throw new Error('host advance must succeed')
    const result = reduceCommand(hostHit.state, { type: 'advance', actorSeat: 'guest' })
    expect(result.kind).toBe('accepted')
    if (result.kind !== 'accepted') return
    expect(result.state.round).toBe(2)
    expect(result.state.activeSeat).toBe('host')
    expect(result.state.actionPoints).toBe(1)
    expectInvariantsHold(result.state)
  })

  it('completes when the target integrity reaches zero and sets the winner', () => {
    const steps: DomainCommand[] = [
      { type: 'start-demo', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'guest' },
      { type: 'advance', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'guest' },
      { type: 'advance', actorSeat: 'host' },
    ]
    let state = initialGame()
    let lastEvents: DomainEvent[] = []
    for (const step of steps) {
      const result = reduceCommand(state, step)
      if (result.kind !== 'accepted') throw new Error(`step ${step.type} must be accepted`)
      state = result.state
      lastEvents = result.events
      expectInvariantsHold(state)
    }
    expect(state.phase).toBe('completed')
    expect(state.winnerSeat).toBe('host')
    expect(state.activeSeat).toBeNull()
    expect(state.actionPoints).toBe(0)
    expect(state.units.find((u) => u.id === 'guest-unit')?.integrity).toBe(0)
    expect(lastEvents).toEqual([
      { type: 'action-confirmed', actorSeat: 'host', rngIndex: 0, targetSeat: 'guest', targetIntegrity: 0 },
      { type: 'demo-completed', actorSeat: 'host', rngIndex: 0, winnerSeat: 'host' },
    ])
  })

  it('rejects advance outside the active phase with phase_mismatch', () => {
    const result = reduceCommand(initialGame(), { type: 'advance', actorSeat: 'host' })
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('phase_mismatch')
  })

  it('rejects advance from a non-active seat with not_active_seat', () => {
    const started = reduceCommand(initialGame(), { type: 'start-demo', actorSeat: 'host' })
    if (started.kind !== 'accepted') throw new Error('start-demo must succeed')
    const result = reduceCommand(started.state, { type: 'advance', actorSeat: 'guest' })
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('not_active_seat')
  })

  it('rejects advance after completion with phase_mismatch', () => {
    const steps: DomainCommand[] = [
      { type: 'start-demo', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'guest' },
      { type: 'advance', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'guest' },
      { type: 'advance', actorSeat: 'host' },
    ]
    let state = initialGame()
    for (const step of steps) {
      const result = reduceCommand(state, step)
      if (result.kind !== 'accepted') throw new Error(`step ${step.type} must be accepted`)
      state = result.state
    }
    const result = reduceCommand(state, { type: 'advance', actorSeat: 'host' })
    expect(result.kind).toBe('rejected')
    if (result.kind !== 'rejected') return
    expect(result.rejection.code).toBe('phase_mismatch')
  })
})

describe('rejection determinism', () => {
  it.each([
    { code: 'phase_mismatch', state: initialGame(), command: { type: 'advance', actorSeat: 'host' } as const },
  ])('rejects $code without mutating the input state', ({ state, command }) => {
    const snapshot = JSON.stringify(state)
    const result = reduceCommand(deepFreeze(state), command)
    expect(result.kind).toBe('rejected')
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

describe('immutability', () => {
  it('never mutates the input state on accepted transitions', () => {
    const state = deepFreeze(initialGame())
    const result = reduceCommand(state, { type: 'start-demo', actorSeat: 'host' })
    expect(result.kind).toBe('accepted')
    expect(state.phase).toBe('awaiting-player')
  })
})
