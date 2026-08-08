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
import { SkillTreeScene } from '../scenes/SkillTreeScene'
import { MasteryScene } from '../scenes/MasteryScene'
import { TowerScene } from '../scenes/TowerScene'
import { RiftScene } from '../scenes/RiftScene'
import { CodexScene } from '../scenes/CodexScene'
import { AscendScene } from '../scenes/AscendScene'
import { SettingsScene } from '../scenes/SettingsScene'
import { AchievementsScene } from '../scenes/AchievementsScene'
import { ConflictScene } from '../scenes/ConflictScene'
import { StageSelectScene } from '../scenes/StageSelectScene'
import { PrepareBattleScene } from '../scenes/PrepareBattleScene'
import { BattleScene } from '../scenes/BattleScene'
import { ResultScene } from '../scenes/ResultScene'
import { AdminScene } from '../scenes/AdminScene'
import { BattleLabScene } from '../scenes/BattleLabScene'
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
    ConflictScene,
    CreateHeroScene,
    MainMenuScene,
    CharacterScene,
    ShopScene,
    EquipmentScene,
    SkillTreeScene,
    MasteryScene,
    TowerScene,
    RiftScene,
    CodexScene,
    AscendScene,
    SettingsScene,
    AchievementsScene,
    StageSelectScene,
    PrepareBattleScene,
    BattleScene,
    ResultScene,
    // Reachable only through the Test Lab gate; see admin/AdminAccess.
    AdminScene,
    BattleLabScene,
  ],
}
