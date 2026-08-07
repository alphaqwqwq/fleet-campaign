import { describe, expect, it } from 'vitest'

import { pageStatusText } from './App'

describe('pageStatusText', () => {
  it('exposes the baseline status', () => {
    expect(pageStatusText).toBe('房间基础工程准备中')
  })
})
