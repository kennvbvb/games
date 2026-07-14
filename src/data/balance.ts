export const BALANCE = {
  baseExpToLevel: 20,
  expCurveExponent: 1.5,
  baseStats: { maxHp: 50, atk: 10, def: 4 },
  statsPerLevel: { maxHp: 12, atk: 3, def: 1 },
  upgrades: {
    hp: { name: 'Heart Cookie', emoji: '🍪', description: '+10 max HP', bonus: 10, baseCost: 15 },
    atk: { name: 'Sword Candy', emoji: '🍭', description: '+2 ATK', bonus: 2, baseCost: 20 },
    def: { name: 'Shield Donut', emoji: '🍩', description: '+1 DEF', bonus: 1, baseCost: 18 },
  },
  upgradeCostGrowth: 1.35,
} as const
