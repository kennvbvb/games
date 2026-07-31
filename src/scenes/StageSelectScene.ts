import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { makeButton } from '../ui/components/makeButton'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'

const STAGES_PER_PAGE = 6
const ROW_START_Y = 118
const ROW_HEIGHT = 72

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const pageCount = Math.ceil(STAGES.length / STAGES_PER_PAGE)
    const page = Math.min(Math.max(GameState.stagePage, 0), pageCount - 1)
    GameState.stagePage = page

    makeTitle(this, 46, 'Select Stage', 'icon_atk')

    const pageStages = STAGES.slice(page * STAGES_PER_PAGE, (page + 1) * STAGES_PER_PAGE)
    pageStages.forEach((stage, i) => {
      const unlocked = stage.order <= player.stageProgress.highestUnlocked
      const cleared = player.stageProgress.completedStageIds.includes(stage.id)
      const y = ROW_START_Y + i * ROW_HEIGHT

      makeButton(
        this,
        GAME_W / 2,
        y,
        `${stage.order}. ${stage.name}`,
        () => {
          GameState.selectedStage = stage
          this.scene.start('Battle')
        },
        {
          disabled: !unlocked,
          minWidth: 340,
          fontSize: '16px',
          icon: unlocked ? stage.enemy.sprite : 'icon_lock',
        },
      )
      if (cleared) this.add.image(GAME_W / 2 + 158, y, 'icon_star').setDisplaySize(20, 20)
    })

    const pagerY = ROW_START_Y + STAGES_PER_PAGE * ROW_HEIGHT + 4
    makeButton(this, GAME_W / 2 - 110, pagerY, '◀', () => this.turnPage(-1), {
      disabled: page === 0,
      fontSize: '16px',
      minWidth: 64,
    })
    this.add
      .text(GAME_W / 2, pagerY, `Page ${page + 1} / ${pageCount}`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2 + 110, pagerY, '▶', () => this.turnPage(1), {
      disabled: page >= pageCount - 1,
      fontSize: '16px',
      minWidth: 64,
    })

    makeButton(this, GAME_W / 2, pagerY + 76, 'Back', () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '15px',
      minWidth: 160,
    })
  }

  private turnPage(dir: number): void {
    GameState.stagePage += dir
    this.scene.restart()
  }
}
