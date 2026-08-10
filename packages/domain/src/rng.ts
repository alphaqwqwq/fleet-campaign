export interface Rng {
  /** 返回 [0, 1) 的确定性伪随机数；每次调用消费一次随机。 */
  nextRandom(): number
}

const MASK64 = (1n << 64n) - 1n
const LCG_A = 6364136223846793005n
const LCG_C = 1442695040888963407n

/**
 * 由种子构造确定性 RNG（128-bit 种子，取低 64 位初始化状态）。
 * demo-v1 没有消耗随机数的命令，因此所有领域事件 rngIndex 保持 0；
 * 该接口为后续随机规则预留可注入、可复现的消费点。
 */
export function createSeededRng(seed: bigint): Rng {
  let state = seed & MASK64
  return {
    nextRandom(): number {
      state = (LCG_A * state + LCG_C) & MASK64
      return Number(state >> 32n) / 0x1_0000_0000
    },
  }
}
