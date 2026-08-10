import { DEMO_V1, type DemoV1Content } from './types'

/** demo-v1 抽象演示内容夹具：host-unit 与 guest-unit 各有 integrity: 3，行动方每回合 1 点。 */
export const DEMO_V1_CONTENT: DemoV1Content = {
  contentId: DEMO_V1,
  units: [
    { id: 'host-unit', integrity: 3 },
    { id: 'guest-unit', integrity: 3 },
  ],
  actionPoints: 1,
}
