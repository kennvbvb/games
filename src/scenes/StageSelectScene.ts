import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { makeButton } from '../ui/components/makeButton'
import { makeTitle } from '../ui/components/makeTitle'

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!

    makeTitle(this, 42, 'Select Stage', 'icon_atk')

    const startY = 92
    const rowHeight = 44

    STAGES.forEach((stage, i) => {
      const unlocked = stage.order <= player.stageProgress.highestUnlocked
      const cleared = player.stageProgress.completedStageIds.includes(stage.id)
      const y = startY + i * rowHeight

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
          minWidth: 330,
          fontSize: '15px',
          icon: unlocked ? stage.enemy.sprite : 'icon_lock',
        },
      )
      if (cleared) this.add.image(GAME_W / 2 + 152, y, 'icon_star').setDisplaySize(18, 18)
    })

    makeButton(this, GAME_W / 2, startY + STAGES.length * rowHeight + 24, 'Back', () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '14px',
    })
  }
}
