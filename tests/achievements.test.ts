import { describe, it, expect } from 'vitest'
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../src/data/achievements'
import { achievementStatus, achievementList, claimableCount, claimAchievement } from '../src/systems/achievements'
import { createDefaultPlayerState } from '../src/state/playerState'
import { applyRewards } from '../src/systems/rewards'
import { parsePlayerState } from '../src/state/validate'
import { STAGES } from '../src/data/stages'
import type { PlayerState } from '../src/types'

const firstSteps = ACHIEVEMENT_BY_ID.get('first-steps')!
const growing = ACHIEVEMENT_BY_ID.get('growing')!

function withProgress(patch: Partial<PlayerState>): PlayerState {
  return { ...createDefaultPlayerState('Hero'), ...patch }
}

describe('achievement data', () => {
  it('has unique ids and positive targets', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of ACHIEVEMENTS) {
      expect(a.target).toBeGreaterThan(0)
      expect(a.reward).toBeGreaterThan(0)
    }
  })

  it('sets the clear-everything target to the real stage count', () => {
    expect(ACHIEVEMENT_BY_ID.get('champion')!.target).toBe(STAGES.length)
  })
})

describe('achievementStatus', () => {
  it('reports nothing claimable on a fresh save', () => {
    expect(claimableCount(createDefaultPlayerState('Hero'))).toBe(0)
  })

  it('becomes claimable once the target is reached', () => {
    const state = withProgress({
      stageProgress: { highestUnlocked: 2, completedStageIds: [STAGES[0].id] },
    })
    const status = achievementStatus(state, firstSteps)
    expect(status.complete).toBe(true)
    expect(status.claimable).toBe(true)
    expect(status.ratio).toBe(1)
  })

  it('caps displayed progress and ratio at the target', () => {
    const status = achievementStatus(withProgress({ level: 99 }), growing)
    expect(status.current).toBe(growing.target)
    expect(status.ratio).toBe(1)
  })

  it('stops being claimable after it is claimed', () => {
    const state = withProgress({ level: 5, claimedAchievementIds: ['growing'] })
    const status = achievementStatus(state, growing)
    expect(status.complete).toBe(true)
    expect(status.claimed).toBe(true)
    expect(status.claimable).toBe(false)
  })
})

describe('achievementList', () => {
  it('puts claimable first and claimed last', () => {
    const state = withProgress({ level: 10, claimedAchievementIds: ['growing'] })
    const list = achievementList(state)
    const rank = list.map((s) => (s.claimable ? 0 : s.claimed ? 2 : 1))
    expect(rank).toEqual([...rank].sort((a, b) => a - b))
    expect(list.length).toBe(ACHIEVEMENTS.length)
  })
})

describe('claimAchievement', () => {
  it('pays the reward once and records the claim', () => {
    const state = withProgress({ level: 5, gold: 100 })
    const claimed = claimAchievement(state, 'growing')!
    expect(claimed.gold).toBe(100 + growing.reward)
    expect(claimed.claimedAchievementIds).toEqual(['growing'])
    // Claim gold counts as earned so it feeds the wealth achievement.
    expect(claimed.lifetime.goldEarned).toBe(growing.reward)
    expect(claimAchievement(claimed, 'growing')).toBeNull()
  })

  it('refuses an incomplete achievement', () => {
    expect(claimAchievement(withProgress({ level: 1 }), 'growing')).toBeNull()
  })

  it('refuses an unknown id', () => {
    expect(claimAchievement(withProgress({ level: 5 }), 'no-such-thing')).toBeNull()
  })

  it('leaves the original state untouched', () => {
    const state = withProgress({ level: 5, gold: 100 })
    claimAchievement(state, 'growing')
    expect(state.gold).toBe(100)
    expect(state.claimedAchievementIds).toEqual([])
  })
})

describe('lifetime tracking', () => {
  const win = { win: true, rewards: { exp: 10, gold: 25 }, log: [] } as const

  it('counts a win and its gold', () => {
    const after = applyRewards(createDefaultPlayerState('Hero'), { ...win, log: [] })
    expect(after.lifetime.battlesWon).toBe(1)
    expect(after.lifetime.goldEarned).toBe(25)
  })

  it('counts nothing for a loss', () => {
    const after = applyRewards(createDefaultPlayerState('Hero'), {
      win: false,
      rewards: { exp: 0, gold: 0 },
      log: [],
    })
    expect(after.lifetime).toEqual({ battlesWon: 0, goldEarned: 0 })
  })

  it('survives a save round-trip and drops tampered values', () => {
    const raw = {
      ...createDefaultPlayerState('Hero'),
      lifetime: { battlesWon: -5, goldEarned: Number.NaN },
      claimedAchievementIds: ['growing', 'growing', 'not-an-achievement', 7],
    }
    const parsed = parsePlayerState(raw)!
    expect(parsed.lifetime).toEqual({ battlesWon: 0, goldEarned: 0 })
    expect(parsed.claimedAchievementIds).toEqual(['growing'])
  })
})
