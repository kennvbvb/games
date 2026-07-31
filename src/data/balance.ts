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
  idle: {
    /** Longest stretch of absence that still pays out. */
    maxOfflineMs: 8 * 60 * 60 * 1000,
    /** Below this, returning players get no popup at all. */
    minRewardMs: 60 * 1000,
    /**
     * How long one offline auto-battle takes. Deliberately slower than an
     * active battle, which is what makes idling less efficient than playing —
     * expressed as time rather than a hidden payout multiplier so the
     * "battles won" figure shown to the player is literally true.
     */
    msPerBattle: 40 * 1000,
  },
} as const
