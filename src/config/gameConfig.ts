import Phaser from 'phaser'
import { GAME_W, GAME_H, RENDER_SCALE } from './layout'
import { BootScene } from '../scenes/BootScene'
import { PreloadScene } from '../scenes/PreloadScene'
import { AuthScene } from '../scenes/AuthScene'
import { CreateHeroScene } from '../scenes/CreateHeroScene'
import { MainMenuScene } from '../scenes/MainMenuScene'
import { CharacterScene } from '../scenes/CharacterScene'
import { ShopScene } from '../scenes/ShopScene'
import { EquipmentScene } from '../scenes/EquipmentScene'
import { SettingsScene } from '../scenes/SettingsScene'
import { AchievementsScene } from '../scenes/AchievementsScene'
import { StageSelectScene } from '../scenes/StageSelectScene'
import { BattleScene } from '../scenes/BattleScene'
import { ResultScene } from '../scenes/ResultScene'
import { COLORS } from '../ui/styles'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_W * RENDER_SCALE,
  height: GAME_H * RENDER_SCALE,
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
    CreateHeroScene,
    MainMenuScene,
    CharacterScene,
    ShopScene,
    EquipmentScene,
    SettingsScene,
    AchievementsScene,
    StageSelectScene,
    BattleScene,
    ResultScene,
  ],
}
