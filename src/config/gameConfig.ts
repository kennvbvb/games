import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { PreloadScene } from '../scenes/PreloadScene'
import { AuthScene } from '../scenes/AuthScene'
import { MainMenuScene } from '../scenes/MainMenuScene'
import { StageSelectScene } from '../scenes/StageSelectScene'
import { BattleScene } from '../scenes/BattleScene'
import { ResultScene } from '../scenes/ResultScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 480,
  height: 720,
  backgroundColor: '#101820',
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, AuthScene, MainMenuScene, StageSelectScene, BattleScene, ResultScene],
}
