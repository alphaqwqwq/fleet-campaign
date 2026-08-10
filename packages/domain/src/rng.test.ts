import { describe, expect, it } from 'vitest'

import { DEMO_V1_CONTENT } from '@fleet-campaign/content'

import { createInitialState, createSeededRng, reduceCommand, type Rng } from './index'
import type { DomainEvent } from './types'

function initialGame() {
  const result = createInitialState(DEMO_V1_CONTENT)
  if (!result.ok) throw new Error('demo-v1 fixture must be valid')
  return result.state
}

function countingRng(): { rng: Rng; calls: () => number } {
  let calls = 0
  return {
    rng: { nextRandom: () => (calls += 1) },
    calls: () => calls,
  }
}

describe('createSeededRng', () => {
  it('reproduces the same sequence for the same seed', () => {
    const a = createSeededRng(12345678901234567890n)
    const b = createSeededRng(12345678901234567890n)
    const seqA = [a.nextRandom(), a.nextRandom(), a.nextRandom()]
    const seqB = [b.nextRandom(), b.nextRandom(), b.nextRandom()]
    expect(seqA).toEqual(seqB)
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true)
  })

  it('produces a different sequence for a different seed', () => {
    const a = createSeededRng(1n)
    const b = createSeededRng(2n)
    expect(a.nextRandom()).not.toBe(b.nextRandom())
  })
})

describe('demo-v1 zero rng consumption', () => {
  it.each([
    { type: 'start-demo', actorSeat: 'host' },
    { type: 'advance', actorSeat: 'host' },
  ] as const)('does not consume randomness for $type', (command) => {
    let source = initialGame()
    if (command.type === 'advance') {
      const started = reduceCommand(source, { type: 'start-demo', actorSeat: 'host' })
      if (started.kind !== 'accepted') throw new Error('start-demo must succeed')
      source = started.state
    }
    const { rng, calls } = countingRng()
    const result = reduceCommand(source, command, rng)
    expect(result.kind).toBe('accepted')
    expect(calls()).toBe(0)
  })

  it('emits rngIndex 0 for every event', () => {
    const steps = [
      { type: 'start-demo', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'guest' },
      { type: 'advance', actorSeat: 'host' },
      { type: 'advance', actorSeat: 'guest' },
      { type: 'advance', actorSeat: 'host' },
    ] as const
    let state = initialGame()
    const events: DomainEvent[] = []
    for (const step of steps) {
      const result = reduceCommand(state, step)
      if (result.kind !== 'accepted') throw new Error(`step must be accepted`)
      state = result.state
      events.push(...result.events)
    }
    expect(events.length).toBeGreaterThan(0)
    for (const event of events) expect(event.rngIndex).toBe(0)
  })
})

describe('deterministic replay', () => {
  const steps = [
    { type: 'start-demo', actorSeat: 'host' },
    { type: 'advance', actorSeat: 'host' },
    { type: 'advance', actorSeat: 'guest' },
    { type: 'advance', actorSeat: 'host' },
    { type: 'advance', actorSeat: 'guest' },
    { type: 'advance', actorSeat: 'host' },
  ] as const

  function run() {
    const rng = createSeededRng(0xdeadbeefn)
    let state = initialGame()
    const events: DomainEvent[] = []
    for (const step of steps) {
      const result = reduceCommand(state, step, rng)
      if (result.kind !== 'accepted') throw new Error(`step must be accepted`)
      state = result.state
      events.push(...result.events)
    }
    return { state, events }
  }

  it('reproduces identical state and events for the same seed and command sequence', () => {
    expect(run()).toEqual(run())
  })
})
