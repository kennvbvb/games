import Phaser from 'phaser'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { makeButton } from '../ui/components/makeButton'
import { COLORS } from '../ui/styles'

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect')
  }

  create(): void {
    const { width } = this.scale
    const player = GameState.player!

    this.add.text(width / 2, 40, 'Select Stage', { fontSize: '24px', color: COLORS.text }).setOrigin(0.5)

    const startY = 90
    const rowHeight = 44

    STAGES.forEach((stage, i) => {
      const unlocked = stage.order <= player.stageProgress.highestUnlocked
      const cleared = player.stageProgress.completedStageIds.includes(stage.id)
      const label = `${stage.order}. ${stage.name}${cleared ? ' ✓' : ''}${unlocked ? '' : ' (locked)'}`
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
        { disabled: !unlocked },
      )
    })

    makeButton(this, width / 2, startY + STAGES.length * rowHeight + 20, 'Back', () => this.scene.start('MainMenu'))
  }
}
