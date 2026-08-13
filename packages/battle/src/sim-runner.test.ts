import { describe, expect, it } from 'vitest'

import { buildSimContent, formatSimulation, runSimulation } from './sim'

describe('battle simulation sandbox', () => {
  it('runs a full scripted engagement deterministically', () => {
    const content = buildSimContent()
    const a = runSimulation(content, { seed: 0x5eedn })
    const b = runSimulation(content, { seed: 0x5eedn })
    expect(a.state).toEqual(b.state)
    expect(a.events).toEqual(b.events)
  })

  it('produces a readable log', () => {
    const content = buildSimContent()
    const log = formatSimulation(content, { seed: 0x5eedn })
    expect(log).toContain('seed=')
    expect(log).toContain('战果')
    expect(log.split('\n').length).toBeGreaterThan(20)
    console.log('\n' + log + '\n')
  })
})
