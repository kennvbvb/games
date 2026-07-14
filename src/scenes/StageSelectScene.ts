import Phaser from 'phaser'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { makeButton } from '../ui/components/makeButton'
import { COLORS, FONT } from '../ui/styles'

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect')
  }

  create(): void {
    const { width } = this.scale
    const player = GameState.player!

    this.add
      .text(width / 2, 42, '⚔️ Select Stage', {
        fontSize: '26px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    const startY = 92
    const rowHeight = 44

    STAGES.forEach((stage, i) => {
      const unlocked = stage.order <= player.stageProgress.highestUnlocked
      const cleared = player.stageProgress.completedStageIds.includes(stage.id)
      const icon = unlocked ? stage.enemy.emoji ?? '👾' : '🔒'
      const label = `${icon} ${stage.order}. ${stage.name}${cleared ? ' ⭐' : ''}`
      const y = startY + i * rowHeight

      makeButton(
        this,
        width / 2,
        y,
        label,
        () => {
          GameState.selectedStage = stage
          this.scene.start('Battle')
        },
        { disabled: !unlocked, minWidth: 330, fontSize: '15px' },
      )
    })

    makeButton(this, width / 2, startY + STAGES.length * rowHeight + 22, 'Back', () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '14px',
    })
  }
}
