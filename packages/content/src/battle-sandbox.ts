import type { BattleContent } from './battle-types'

/** 交战沙盒 v1：双方各一旗舰 + 一护航主力舰，自创抽象名，用于引擎测试与沙盒试玩。 */
export const BATTLE_SANDBOX_V1: BattleContent = {
  contentId: 'battle-sandbox-v1',
  kind: 'battle-v1',
  battleGroups: [
    {
      id: 'player-group',
      faction: 'player',
      startingDistance: 3,
      flagship: {
        id: 'p-flag',
        type: 'battleship',
        hp: 12,
        defense: 12,
        flag: true,
        blockBonus: 0,
        weapons: [
          { id: 'p-flag-main', size: 'main', damage: '2d6', range: 5, crit: true },
          { id: 'p-flag-charge', size: 'superheavy', damage: '3d6', range: 4, charge: 2, crit: true },
        ],
      },
      ships: [
        {
          id: 'p-escort',
          type: 'frigate',
          hp: 6,
          defense: 13,
          blockBonus: 1,
          weapons: [{ id: 'p-esc-main', size: 'main', damage: '1d6', range: 3 }],
        },
      ],
    },
    {
      id: 'enemy-group',
      faction: 'enemy',
      startingDistance: 3,
      flagship: {
        id: 'e-flag',
        type: 'carrier',
        hp: 10,
        defense: 11,
        flag: true,
        blockBonus: 0,
        weapons: [
          { id: 'e-flag-payload', size: 'main', damage: '1d6+2', range: 5, payload: 3, area: true },
          { id: 'e-flag-secondary', size: 'secondary', damage: '1d6', range: 2 },
        ],
      },
      ships: [
        {
          id: 'e-escort',
          type: 'frigate',
          hp: 6,
          defense: 12,
          blockBonus: 1,
          weapons: [{ id: 'e-esc-main', size: 'main', damage: '1d6', range: 4 }],
        },
      ],
    },
  ],
}
