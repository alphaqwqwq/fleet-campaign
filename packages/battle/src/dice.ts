import { createSeededRng, type Rng } from '@fleet-campaign/domain'

export type { Rng }
export { createSeededRng }

export function createDeterministicRng(seed: bigint): Rng {
  return createSeededRng(seed)
}

/** 1dN：消费一次随机，返回 [1, N]。 */
export function rollD(rand: () => number, sides: number): number {
  return Math.floor(rand() * sides) + 1
}

/** 掷 count 个 dSides 并取最大值（准度/难度骰规则：取最高）。 */
export function rollMaxD(rand: () => number, count: number, sides: number): number {
  let max = 0
  for (let i = 0; i < count; i++) {
    const value = rollD(rand, sides)
    if (value > max) max = value
  }
  return max
}

export interface DiceResult {
  value: number
  /** 实际消费的随机数个数（供 rngIndex 记账）。 */
  consumed: number
}

/** 解析伤害表达式：固定值 <n> 或 <n>d<sides>[+<bonus>]。 */
export function parseDamageExpression(expr: string): { count: number; sides: number; bonus: number } {
  const diceMatch = /^(\d+)d(\d+)(\+\d+)?$/.exec(expr)
  if (diceMatch) {
    return {
      count: Number(diceMatch[1]),
      sides: Number(diceMatch[2]),
      bonus: diceMatch[3] ? Number(diceMatch[3].slice(1)) : 0,
    }
  }
  const flatMatch = /^(\d+)$/.exec(expr)
  if (flatMatch) {
    return { count: 0, sides: 0, bonus: Number(flatMatch[1]) }
  }
  throw new Error(`invalid damage expression: ${expr}`)
}

/** 掷伤害：count 个 dSides 求和 + bonus。无骰子时（固定值）不消费随机。 */
export function rollDamage(rand: () => number, expr: string): DiceResult {
  const { count, sides, bonus } = parseDamageExpression(expr)
  let sum = bonus
  for (let i = 0; i < count; i++) sum += rollD(rand, sides)
  return { value: sum, consumed: count }
}
