import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { branchesFor, prerequisiteOf, skillCost } from '../data/skills'
import { raceOf } from '../data/races'
import {
  LOADOUT_SIZE,
  availableSkillPoints,
  equipSkill,
  respec,
  respecCost,
  unequipSkill,
  unlockBlocker,
  unlockSkill,
} from '../systems/skills'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { SkillConfig } from '../data/skills'
import type { PlayerState } from '../types'
import { t } from '../i18n'

const CARD_YS = [164, 244, 324, 404]
const CARD_H = 76
const SLOT_Y = 516
const SLOT_W = 106

interface SkillSceneData {
  branch?: number
  notice?: string
}

/**
 * Three branches of four, one branch on screen at a time.
 *
 * Showing all twelve at once was the obvious layout and the wrong one: twelve
 * cards in 480x720 leaves about forty pixels each, which is not enough room for
 * the description — and a skill the player cannot read the effect of is a skill
 * they will not choose deliberately.
 */
export class SkillTreeScene extends Phaser.Scene {
  private branch = 0
  private notice = ''

  constructor() {
    super('SkillTree')
  }

  init(data: SkillSceneData): void {
    this.branch = data.branch ?? 0
    this.notice = data.notice ?? ''
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const branches = branchesFor(player.raceId)
    const active = Math.min(Math.max(this.branch, 0), branches.length - 1)
    this.branch = active
    const branch = branches[active]
    const points = availableSkillPoints(player)

    makeTitle(this, 36, t('skills.title'), 'icon_star', { fontSize: '22px', iconSize: 19 })
    // Kin and points share a line: the header was costing 20px that the first
    // card needed, and the two tab rows were overlapping it.
    this.add
      .text(
        GAME_W / 2,
        62,
        `${t(raceOf(player.raceId).nameKey)}  ·  ${points > 0 ? t('skills.points', { points }) : t('skills.noPoints')}`,
        {
          fontSize: '13px',
          fontFamily: FONT.family,
          fontStyle: points > 0 ? 'bold' : 'normal',
          color: points > 0 ? COLORS.gold : COLORS.textDim,
        },
      )
      .setOrigin(0.5)

    branches.forEach((b, i) => {
      const owned = b.skills.filter((s) => player.unlockedSkillIds.includes(s.id)).length
      makeButton(this, 84 + i * 156, 96, `${b.name} ${owned}/4`, () => this.scene.restart({ branch: i }), {
        variant: i === active ? 'primary' : 'secondary',
        minWidth: 144,
        minHeight: 46,
        fontSize: '12px',
      })
    })

    branch.skills.forEach((skill, i) => this.renderSkill(skill, CARD_YS[i], player))
    this.renderLoadout(player)

    if (this.notice) {
      this.add
        .text(GAME_W / 2, 578, this.notice, {
          fontSize: '11px',
          fontFamily: FONT.family,
          color: COLORS.danger,
          align: 'center',
          wordWrap: { width: 420 },
        })
        .setOrigin(0.5)
    }

    const cost = respecCost(player)
    makeButton(
      this,
      GAME_W / 2 - 110,
      626,
      cost === 0 ? t('skills.respecFree') : t('skills.respecCost', { gold: cost }),
      () => this.doRespec(),
      { variant: 'secondary', minWidth: 200, minHeight: 44, fontSize: '12px' },
    )
    makeButton(this, GAME_W / 2 + 110, 626, t('common.back'), () => this.scene.start('Character'), {
      variant: 'secondary',
      minWidth: 160,
      minHeight: 44,
      fontSize: '14px',
    })
  }

  private renderSkill(skill: SkillConfig, y: number, player: PlayerState): void {
    const owned = player.unlockedSkillIds.includes(skill.id)
    const equipped = player.loadout.includes(skill.id)
    const blocker = unlockBlocker(player, skill.id)
    const locked = !owned && blocker === 'prerequisite'

    makePanel(this, GAME_W / 2, y, 440, CARD_H)
    const top = y - CARD_H / 2

    makeEmoji(this, 50, y - 8, locked ? 'icon_lock' : skill.icon, 26)
    this.add
      .text(50, y + 18, `T${skill.tier}`, {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    const title = this.add
      .text(78, top + 20, skill.name, {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: locked ? COLORS.textDisabled : COLORS.text,
      })
      .setOrigin(0, 0.5)

    if (equipped) {
      this.add
        .text(title.x + title.width + 10, top + 20, '●', {
          fontSize: '13px',
          fontFamily: FONT.family,
          color: COLORS.success,
        })
        .setOrigin(0, 0.5)
    } else if (!owned) {
      const cost = skillCost(skill.tier)
      this.add
        .text(title.x + title.width + 10, top + 20, t(cost === 1 ? 'skills.cost' : 'skills.costs', { cost }), {
          fontSize: '11px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.gold,
        })
        .setOrigin(0, 0.5)
    }

    const prerequisite = prerequisiteOf(skill)
    this.add
      .text(
        78,
        top + 46,
        locked && prerequisite ? t('skills.needPrereq', { skill: prerequisite.name }) : skill.description,
        {
          fontSize: '11px',
          fontFamily: FONT.family,
          color: locked ? COLORS.textDim : COLORS.textDim,
          wordWrap: { width: 246 },
        },
      )
      .setOrigin(0, 0.5)

    if (!owned) {
      makeButton(this, 386, y, t('skills.unlock'), () => this.doUnlock(skill), {
        disabled: blocker !== null,
        minWidth: 92,
        minHeight: 46,
        fontSize: '12px',
      })
      return
    }

    makeButton(
      this,
      386,
      y,
      equipped ? t('skills.unequip') : t('skills.equip'),
      () => this.toggleEquip(skill, equipped),
      {
        variant: equipped ? 'secondary' : 'primary',
        disabled: !equipped && player.loadout.length >= LOADOUT_SIZE,
        minWidth: 92,
        minHeight: 46,
        fontSize: '12px',
      },
    )
  }

  /** Four slots, always drawn — an empty one is the clearest prompt to fill it. */
  private renderLoadout(player: PlayerState): void {
    this.add
      .text(28, 470, t('skills.loadout', { used: player.loadout.length, total: LOADOUT_SIZE }), {
        fontSize: '13px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(GAME_W - 28, 470, t('skills.tapToRemove'), {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(1, 0.5)

    for (let i = 0; i < LOADOUT_SIZE; i++) {
      const x = 62 + i * (SLOT_W + 4)
      const id = player.loadout[i]
      makePanel(this, x, SLOT_Y, SLOT_W, 62)
      if (!id) {
        this.add
          .text(x, SLOT_Y, t('skills.slotEmpty'), {
            fontSize: '10px',
            fontFamily: FONT.family,
            color: COLORS.textDisabled,
          })
          .setOrigin(0.5)
        continue
      }
      const skill = branchesFor(player.raceId)
        .flatMap((b) => b.skills)
        .find((s) => s.id === id)!
      makeEmoji(this, x, SLOT_Y - 14, skill.icon, 22)
      this.add
        .text(x, SLOT_Y + 16, skill.name, {
          fontSize: '9px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.text,
          align: 'center',
          wordWrap: { width: SLOT_W - 10 },
        })
        .setOrigin(0.5)

      const hit = this.add
        .rectangle(x, SLOT_Y, SLOT_W, 62, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => this.toggleEquip(skill, true))
    }
  }

  private doUnlock(skill: SkillConfig): void {
    const player = GameState.player!
    const blocker = unlockBlocker(player, skill.id)
    if (blocker !== null) {
      this.scene.restart({
        branch: this.branch,
        notice: blocker === 'points' ? t('skills.needPoints') : '',
      })
      return
    }
    this.commit(unlockSkill(player, skill.id)!)
  }

  private toggleEquip(skill: SkillConfig, equipped: boolean): void {
    const player = GameState.player!
    const next = equipped ? unequipSkill(player, skill.id) : equipSkill(player, skill.id)
    if (next === player) {
      this.scene.restart({ branch: this.branch, notice: t('skills.loadoutFull') })
      return
    }
    this.commit(next)
  }

  private doRespec(): void {
    const player = GameState.player!
    const next = respec(player)
    if (next === null) {
      this.scene.restart({
        branch: this.branch,
        notice: t('skills.respecPoor', { gold: respecCost(player) }),
      })
      return
    }
    this.commit(next)
  }

  /** Every mutation persists: a tree edit lost to a closed tab is a real loss. */
  private commit(next: PlayerState): void {
    GameState.player = next
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.restart({ branch: this.branch })
  }
}
