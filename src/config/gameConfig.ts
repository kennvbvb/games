import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { PreloadScene } from '../scenes/PreloadScene'
import { AuthScene } from '../scenes/AuthScene'
import { MainMenuScene } from '../scenes/MainMenuScene'
import { CharacterScene } from '../scenes/CharacterScene'
import { ShopScene } from '../scenes/ShopScene'
import { StageSelectScene } from '../scenes/StageSelectScene'
import { BattleScene } from '../scenes/BattleScene'
import { ResultScene } from '../scenes/ResultScene'
import { COLORS } from '../ui/styles'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 480,
  height: 720,
  backgroundColor: COLORS.pageBg,
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloadScene,
    AuthScene,
    MainMenuScene,
    CharacterScene,
    ShopScene,
    StageSelectScene,
    BattleScene,
    ResultScene,
  ],
}
