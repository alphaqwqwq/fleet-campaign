import { describe, expect, it } from 'vitest'

import {
  DEMO_V1_ACTION_POINTS,
  DEMO_V1_CONTENT,
  DEMO_V1_MAX_INTEGRITY,
  validateDemoV1Content,
} from './index'

describe('DEMO_V1_CONTENT', () => {
  it('is a valid demo-v1 content fixture', () => {
    const result = validateDemoV1Content(DEMO_V1_CONTENT)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.contentId).toBe('demo-v1')
      expect(result.value.units).toHaveLength(2)
    }
  })
})

describe('validateDemoV1Content', () => {
  it('accepts a valid demo-v1 template', () => {
    const result = validateDemoV1Content(DEMO_V1_CONTENT)
    expect(result.ok).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(validateDemoV1Content(null).ok).toBe(false)
    expect(validateDemoV1Content('demo-v1').ok).toBe(false)
    expect(validateDemoV1Content([]).ok).toBe(false)
  })

  it('rejects an unknown contentId', () => {
    const result = validateDemoV1Content({ ...DEMO_V1_CONTENT, contentId: 'original-game' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('contentId')
  })

  it('rejects the wrong number of units', () => {
    const result = validateDemoV1Content({
      ...DEMO_V1_CONTENT,
      units: [{ id: 'host-unit', integrity: DEMO_V1_MAX_INTEGRITY }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('units')
  })

  it('rejects a missing required unit id', () => {
    const result = validateDemoV1Content({
      ...DEMO_V1_CONTENT,
      units: [
        { id: 'host-unit', integrity: DEMO_V1_MAX_INTEGRITY },
        { id: 'spectator-unit', integrity: DEMO_V1_MAX_INTEGRITY },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('host-unit, guest-unit')
  })

  it('rejects an integrity other than 3', () => {
    const result = validateDemoV1Content({
      ...DEMO_V1_CONTENT,
      units: [
        { id: 'host-unit', integrity: 4 },
        { id: 'guest-unit', integrity: DEMO_V1_MAX_INTEGRITY },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain('integrity')
  })

  it('rejects an actionPoints other than 1', () => {
    const result = validateDemoV1Content({ ...DEMO_V1_CONTENT, actionPoints: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join()).toContain(`actionPoints must be ${DEMO_V1_ACTION_POINTS}`)
  })
})
