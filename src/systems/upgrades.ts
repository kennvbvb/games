import { BALANCE } from '../data/balance'
import type { PlayerState, PlayerStats, UpgradeType } from '../types'

export function upgradeCost(type: UpgradeType, owned: number): number {
  return Math.round(BALANCE.upgrades[type].baseCost * Math.pow(BALANCE.upgradeCostGrowth, owned))
}

export function upgradeBonus(type: UpgradeType, owned: number): number {
  return BALANCE.upgrades[type].bonus * owned
}

/** Level-derived base stats plus permanent bonuses bought in the shop. */
export function effectiveStats(state: PlayerState): PlayerStats {
  return {
    maxHp: state.stats.maxHp + upgradeBonus('hp', state.upgrades.hp),
    atk: state.stats.atk + upgradeBonus('atk', state.upgrades.atk),
    def: state.stats.def + upgradeBonus('def', state.upgrades.def),
  }
}

/** Returns the new state, or null if the player can't afford the upgrade. */
export function buyUpgrade(state: PlayerState, type: UpgradeType): PlayerState | null {
  const cost = upgradeCost(type, state.upgrades[type])
  if (state.gold < cost) return null
  return {
    ...state,
    gold: state.gold - cost,
    upgrades: { ...state.upgrades, [type]: state.upgrades[type] + 1 },
  }
}
