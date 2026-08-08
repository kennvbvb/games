import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { createDefaultPlayerState } from '../state/playerState'
import { persist } from '../services/saveService'
import { RACES, raceOf, raceTextureKey } from '../data/races'
import { statsForLevel } from '../systems/leveling'
import { makeButton } from '../ui/components/makeButton'
import { makeDom } from '../ui/components/makeDom'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { ambientTween } from '../ui/motion'
import { COLORS, FONT } from '../ui/styles'
import type { RaceId } from '../data/races'
import { t } from '../i18n'

/**
 * Two steps, because name, kin and look together will not fit one 480x720
 * screen without shrinking everything below a comfortable tap target.
 */
type Step = 'identity' | 'look'

interface CreateHeroData {
  step?: Step
  name?: string
  raceId?: RaceId
  appearanceId?: string
}

export class CreateHeroScene extends Phaser.Scene {
  private step: Step = 'identity'
  private heroName = ''
  private raceId: RaceId = RACES[0].id
  private appearanceId: string = RACES[0].appearances[0]
  private nameInput?: HTMLInputElement

  constructor() {
    super('CreateHero')
  }

  init(data: CreateHeroData): void {
    this.step = data.step ?? 'identity'
    if (data.name !== undefined) this.heroName = data.name
    if (data.raceId !== undefined) this.raceId = data.raceId
    this.appearanceId = data.appearanceId ?? raceOf(this.raceId).appearances[0]
  }

  create(): void {
    setupScene(this)
    this.add
      .text(GAME_W / 2, 44, t('hero.create'), {
        fontSize: '24px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 72, t('hero.step', { current: this.step === 'identity' ? 1 : 2, total: 2 }), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    if (this.step === 'identity') this.buildIdentityStep()
    else this.buildLookStep()
  }

  /** Step 1: name and kin, showing what each kin starts from. */
  private buildIdentityStep(): void {
    const inputStyle =
      'width:100%;box-sizing:border-box;padding:11px 14px;font-size:16px;border-radius:14px;border:2px solid #f3d9e5;background:#fff;color:#5d4a66;outline:none;font-family:inherit;text-align:center'
    const dom = makeDom(
      this,
      GAME_W / 2,
      112,
      `<div style="width:250px"><input id="hero-name" type="text" maxlength="14" value="${this.heroName}" placeholder="${t('hero.namePlaceholder')}" style="${inputStyle}" /></div>`,
    )
    this.nameInput = dom.getChildByID('hero-name') as HTMLInputElement

    this.add
      .text(GAME_W / 2, 152, t('hero.chooseRace'), {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    // Two columns of three keeps every card a comfortable tap target.
    RACES.forEach((race, i) => {
      const x = GAME_W / 2 + ((i % 2) - 0.5) * 224
      const y = 216 + Math.floor(i / 2) * 104
      const selected = race.id === this.raceId
      makePanel(this, x, y, 212, 92)

      if (selected) {
        this.add.graphics().lineStyle(3, COLORS.primary, 1).strokeRoundedRect(x - 106, y - 46, 212, 92, 18)
      }

      const sprite = makeEmoji(this, x - 72, y - 10, raceTextureKey(race.id, race.appearances[0]), 38)
      if (selected) {
        ambientTween(this, {
          targets: sprite,
          scale: { from: sprite.scale, to: sprite.scale * 1.09 },
          duration: 900,
          yoyo: true,
          repeat: -1,
        })
      }

      this.add
        .text(x - 46, y - 22, t(race.nameKey), {
          fontSize: '16px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.text,
        })
        .setOrigin(0, 0.5)

      const base = statsForLevel(1, race.id)
      this.add
        .text(x - 46, y + 2, t('hero.stats', { hp: base.maxHp, atk: base.atk, def: base.def }), {
          fontSize: '10px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5)

      this.add
        .text(x - 92, y + 30, t(race.passiveNameKey), {
          fontSize: '11px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.gold,
        })
        .setOrigin(0, 0.5)

      this.add
        .rectangle(x, y, 212, 92, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.pickRace(race.id))
    })

    this.add
      .text(GAME_W / 2, 550, t(raceOf(this.raceId).passiveDescriptionKey), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5)

    const warning = this.add
      .text(GAME_W / 2, 588, '', { fontSize: '12px', fontFamily: FONT.family, color: COLORS.danger })
      .setOrigin(0.5)

    makeButton(
      this,
      GAME_W / 2,
      644,
      t('hero.next'),
      () => {
        const name = (this.nameInput?.value ?? '').trim()
        // Say why rather than disabling the button: a dead control with no
        // explanation is the more frustrating of the two.
        if (!name) {
          warning.setText(t('hero.needName'))
          this.nameInput?.focus()
          return
        }
        this.scene.restart({ step: 'look', name, raceId: this.raceId } satisfies CreateHeroData)
      },
      { minWidth: 250, icon: 'icon_levelup' },
    )
  }

  /** Step 2: which of this kin's looks, then confirm. */
  private buildLookStep(): void {
    const race = raceOf(this.raceId)

    makePanel(this, GAME_W / 2, 190, 240, 150)
    const preview = makeEmoji(this, GAME_W / 2, 178, raceTextureKey(this.raceId, this.appearanceId), 84)
    ambientTween(this, { targets: preview, y: 170, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    this.add
      .text(GAME_W / 2, 244, `${this.heroName}  ·  ${t(race.nameKey)}`, {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    this.add
      .text(GAME_W / 2, 296, t('hero.chooseLook'), {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    race.appearances.forEach((appearance, i) => {
      const x = GAME_W / 2 + (i - (race.appearances.length - 1) / 2) * 120
      const y = 364
      const selected = appearance === this.appearanceId
      this.add
        .graphics()
        .fillStyle(selected ? COLORS.primary : COLORS.panel, selected ? 0.28 : 1)
        .fillCircle(x, y, 42)
        .lineStyle(3, selected ? COLORS.primary : COLORS.panelStroke, 1)
        .strokeCircle(x, y, 42)
      makeEmoji(this, x, y, raceTextureKey(this.raceId, appearance), 54)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.scene.restart({
            step: 'look',
            name: this.heroName,
            raceId: this.raceId,
            appearanceId: appearance,
          } satisfies CreateHeroData)
        })
    })

    this.add
      .text(GAME_W / 2, 442, t(race.descriptionKey), {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5)

    makePanel(this, GAME_W / 2, 506, 400, 72)
    this.add
      .text(GAME_W / 2, 488, t(race.passiveNameKey), {
        fontSize: '14px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 516, t(race.passiveDescriptionKey), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 366 },
      })
      .setOrigin(0.5)

    makeButton(this, GAME_W / 2, 586, t('hero.start'), () => void this.startGame(), {
      minWidth: 250,
      icon: 'icon_levelup',
    })
    makeButton(
      this,
      GAME_W / 2,
      654,
      t('hero.back'),
      () =>
        this.scene.restart({
          step: 'identity',
          name: this.heroName,
          raceId: this.raceId,
        } satisfies CreateHeroData),
      { variant: 'secondary', minWidth: 180, fontSize: '15px' },
    )
  }

  private pickRace(raceId: RaceId): void {
    this.scene.restart({
      step: 'identity',
      name: (this.nameInput?.value ?? this.heroName).trim(),
      raceId,
    } satisfies CreateHeroData)
  }

  private async startGame(): Promise<void> {
    const name = this.heroName.trim().slice(0, 14) || 'Hero'
    const state = createDefaultPlayerState(name, undefined, this.raceId, this.appearanceId)
    GameState.player = await persist(state, GameState.userId)
    this.scene.start('MainMenu')
  }
}
