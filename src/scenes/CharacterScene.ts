import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { heroTexture, raceOf } from '../data/races'
import { expToNext } from '../systems/leveling'
import { effectiveStats, equippedItems, totalBonus } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { availableSkillPoints } from '../systems/skills'
import { masteryRank } from '../systems/mastery'
import { EQUIP_SLOTS } from '../systems/upgrades'
import { makePanel } from '../ui/components/makePanel'
import { makeBar } from '../ui/components/makeBar'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { ambientTween } from '../ui/motion'
import { COLORS, FONT } from '../ui/styles'
import { t } from '../i18n'

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('Character')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const stats = effectiveStats(player)
    const bonus = totalBonus(player)
    const nextExp = expToNext(player.level)

    makeTitle(this, 48, t('character.title'), 'icon_face')

    // Hero card with level + EXP progress
    makePanel(this, GAME_W / 2, 170, 400, 170)
    const hero = makeEmoji(this, GAME_W / 2, 138, heroTexture(player), 70)
    ambientTween(this, { targets: hero, angle: { from: -4, to: 4 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    this.add
      .text(GAME_W / 2, 192, `${player.name}  ·  Lv ${player.level}`, {
        fontSize: '19px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    makeBar(this, GAME_W / 2, 220, 320, 14, COLORS.expBar).set(player.exp / nextExp)
    const expLabel = this.add
      .text(GAME_W / 2 + 8, 240, t('character.exp', { current: player.exp, next: nextExp }), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeEmoji(this, expLabel.x - expLabel.width / 2 - 10, 240, 'icon_exp', 14)

    // Stats card: base (from level) + bonus (treats and gear)
    makePanel(this, GAME_W / 2, 360, 400, 180)
    const rows = [
      { icon: 'icon_hp', label: t('character.hp'), base: player.stats.maxHp, bonus: bonus.hp, total: stats.maxHp },
      { icon: 'icon_atk', label: t('character.atk'), base: player.stats.atk, bonus: bonus.atk, total: stats.atk },
      { icon: 'icon_def', label: t('character.def'), base: player.stats.def, bonus: bonus.def, total: stats.def },
    ]
    rows.forEach((row, i) => {
      const y = 312 + i * 40
      makeEmoji(this, 78, y, row.icon, 20)
      this.add
        .text(98, y, row.label, { fontSize: '17px', fontFamily: FONT.family, color: COLORS.text })
        .setOrigin(0, 0.5)
      this.add
        .text(402, y, row.bonus > 0 ? `${row.total}` : `${row.total}`, {
          fontSize: '18px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.text,
        })
        .setOrigin(1, 0.5)
      if (row.bonus > 0) {
        this.add
          .text(402, y + 15, `${row.base} + ${row.bonus}`, {
            fontSize: '11px',
            fontFamily: FONT.family,
            color: COLORS.success,
          })
          .setOrigin(1, 0.5)
      }
    })
    makeEmoji(this, GAME_W / 2 - 42, 428, 'icon_gold', 17)
    this.add
      .text(GAME_W / 2 - 28, 428, t('menu.gold', { gold: player.gold }), {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.gold,
      })
      .setOrigin(0, 0.5)

    const cleared = player.stageProgress.completedStageIds.length
    makeEmoji(this, 128, 472, 'icon_star', 17)
    this.add
      .text(146, 472, t('character.stagesCleared', { cleared, total: STAGES.length }), {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)
    const worn = equippedItems(player).length
    makeEmoji(this, 128, 500, 'icon_bag', 17)
    this.add
      .text(146, 500, t('character.gearSummary', { worn, slots: EQUIP_SLOTS.length, owned: player.ownedItemIds.length }), {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)

    // Kin and passive, plus the animal buddy chosen before kin existed — kept
    // so nobody's original pick is silently thrown away.
    const race = raceOf(player.raceId)
    this.add
      .text(146, 528, `${t(race.nameKey)}  ·  ${t(race.passiveNameKey)}`, {
        fontSize: '14px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0, 0.5)
    makeEmoji(this, 128, 528, heroTexture(player), 17)

    // Labelled, or the animal reads as a stray sprite rather than the buddy
    // this player picked back when that was the whole choice.
    makeEmoji(this, 402, 528, `avatar_${player.avatar}`, 17)
    this.add
      .text(390, 528, t('character.buddy'), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(1, 0.5)
    this.add
      .text(GAME_W / 2, 552, t(race.passiveDescriptionKey), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5)

    // Four across rather than a menu: the skill badge is the only thing that
    // tells a player an unspent point is sitting there, and the mastery rank is
    // the only place the passive ramp is visible at all, so both have to be on
    // the page they already visit to look at their build.
    const points = availableSkillPoints(player)
    const rank = masteryRank(player)
    makeButton(this, 66, 604, t('character.equipment'), () => this.scene.start('Equipment'), {
      minWidth: 108,
      fontSize: '12px',
    })
    makeButton(
      this,
      182,
      604,
      points > 0 ? t('character.skillsBadge', { points }) : t('character.skills'),
      () => this.scene.start('SkillTree'),
      { variant: points > 0 ? 'primary' : 'secondary', minWidth: 108, fontSize: '12px' },
    )
    makeButton(this, 298, 604, t('character.masteryBadge', { rank }), () => this.scene.start('Mastery'), {
      minWidth: 108,
      fontSize: '12px',
    })
    makeButton(this, 414, 604, t('menu.shop'), () => this.scene.start('Shop'), {
      minWidth: 108,
      fontSize: '12px',
    })
    makeButton(this, GAME_W / 2, 670, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '15px',
      minWidth: 160,
    })
  }
}
