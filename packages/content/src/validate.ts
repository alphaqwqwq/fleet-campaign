import { DEMO_V1, type DemoUnitId, type DemoV1Content } from './types'

export const DEMO_V1_MAX_INTEGRITY = 3
export const DEMO_V1_ACTION_POINTS = 1

export const DEMO_UNIT_IDS: readonly DemoUnitId[] = ['host-unit', 'guest-unit']

export type ContentValidation =
  | { ok: true; value: DemoV1Content }
  | { ok: false; errors: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 最小本地内容校验器（无运行时依赖）：验证 demo-v1 抽象模板满足契约。
 * 任何违规都返回确定性错误列表，调用方不得把未通过校验的内容送入领域层。
 */
export function validateDemoV1Content(input: unknown): ContentValidation {
  const errors: string[] = []

  if (!isRecord(input)) {
    return { ok: false, errors: ['content must be an object'] }
  }

  if (input.contentId !== DEMO_V1) {
    errors.push('contentId must be "demo-v1"')
  }

  if (!Array.isArray(input.units)) {
    errors.push('units must be an array')
  } else {
    if (input.units.length !== DEMO_UNIT_IDS.length) {
      errors.push(`units must contain exactly ${DEMO_UNIT_IDS.length} entries`)
    }
    const seen = new Set<string>()
    input.units.forEach((unit, index) => {
      if (!isRecord(unit)) {
        errors.push(`units[${index}] must be an object`)
        return
      }
      if (typeof unit.id !== 'string' || !(DEMO_UNIT_IDS as readonly string[]).includes(unit.id)) {
        errors.push(`units[${index}].id must be one of ${DEMO_UNIT_IDS.join(', ')}`)
      } else if (seen.has(unit.id)) {
        errors.push(`units[${index}].id is duplicated`)
      } else {
        seen.add(unit.id)
      }
      if (unit.integrity !== DEMO_V1_MAX_INTEGRITY) {
        errors.push(`units[${index}].integrity must be ${DEMO_V1_MAX_INTEGRITY}`)
      }
    })
    if (!DEMO_UNIT_IDS.every((id) => seen.has(id))) {
      errors.push(`units must contain all of ${DEMO_UNIT_IDS.join(', ')}`)
    }
  }

  if (input.actionPoints !== DEMO_V1_ACTION_POINTS) {
    errors.push(`actionPoints must be ${DEMO_V1_ACTION_POINTS}`)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, value: input as unknown as DemoV1Content }
}
