export const DEMO_V1 = 'demo-v1'

export type DemoContentId = typeof DEMO_V1

export type DemoUnitId = 'host-unit' | 'guest-unit'

export interface DemoUnitTemplate {
  id: DemoUnitId
  integrity: number
}

/**
 * demo-v1 抽象内容模板：一场抽象双阵营演示遭遇。
 * 唯一改变状态的游戏行动是 `advance`，不含骰子、距离、武器、舰船或原作内容。
 */
export interface DemoV1Content {
  contentId: DemoContentId
  units: DemoUnitTemplate[]
  actionPoints: number
}
