import { describe, it, expect } from 'vitest'
import { resolveBattle } from '../src/systems/combat'
import type { EnemyConfig, PlayerStats } from '../src/types'

const rewards = { exp: 10, gold: 5 }

describe('resolveBattle', () => {
  it('is deterministic for the same inputs', () => {
    const player: PlayerStats = { maxHp: 50, atk: 10, def: 4 }
    const enemy: EnemyConfig = { name: 'Slime', sprite: 'enemy_1', maxHp: 30, atk: 5, def: 1 }
    const a = resolveBattle(player, enemy, rewards)
    const b = resolveBattle(player, enemy, rewards)
    expect(a).toEqual(b)
  })

  it('player wins when clearly stronger and receives rewards', () => {
    const player: PlayerStats = { maxHp: 100, atk: 20, def: 10 }
    const enemy: EnemyConfig = { name: 'Weakling', sprite: 'enemy_1', maxHp: 20, atk: 2, def: 0 }
    const result = resolveBattle(player, enemy, rewards)
    expect(result.win).toBe(true)
    expect(result.rewards).toEqual(rewards)
  })

  it('player loses when clearly weaker and receives no rewards', () => {
    const player: PlayerStats = { maxHp: 10, atk: 1, def: 0 }
    const enemy: EnemyConfig = { name: 'Behemoth', sprite: 'enemy_1', maxHp: 500, atk: 50, def: 20 }
    const result = resolveBattle(player, enemy, rewards)
    expect(result.win).toBe(false)
    expect(result.rewards).toEqual({ exp: 0, gold: 0 })
  })

  it('always deals at least 1 damage per hit, guaranteeing termination even vs. high defense', () => {
    const player: PlayerStats = { maxHp: 1000, atk: 1, def: 1000 }
    const enemy: EnemyConfig = { name: 'Turtle', sprite: 'enemy_1', maxHp: 5, atk: 1, def: 1000 }
    const result = resolveBattle(player, enemy, rewards)
    expect(result.log.length).toBeGreaterThan(0)
    expect(result.log.every((ev) => ev.damage >= 1)).toBe(true)
    expect(result.win).toBe(true)
  })
})
