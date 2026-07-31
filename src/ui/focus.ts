import Phaser from 'phaser'
import { COLORS } from './styles'

interface SceneFocus {
  items: Array<{ target: Phaser.GameObjects.Container; activate: () => void }>
  index: number
  ring: Phaser.GameObjects.Graphics
}

const perScene = new WeakMap<Phaser.Scene, SceneFocus>()

function drawRing(state: SceneFocus): void {
  state.ring.clear()
  const entry = state.items[state.index]
  if (!entry) return
  const { target } = entry
  const w = target.width + 10
  const h = target.height + 10
  state.ring
    .lineStyle(3, COLORS.secondary, 1)
    .strokeRoundedRect(target.x - w / 2, target.y - h / 2, w, h, h / 2)
}

function move(state: SceneFocus, delta: number): void {
  if (state.items.length === 0) return
  // -1 means "nothing focused yet", so the first Tab lands on the first item.
  state.index = state.index < 0 ? (delta > 0 ? 0 : state.items.length - 1) : (state.index + delta + state.items.length) % state.items.length
  drawRing(state)
}

function ensure(scene: Phaser.Scene): SceneFocus {
  const existing = perScene.get(scene)
  if (existing) return existing

  // Drawn above scene content so the ring is never hidden behind a panel.
  const ring = scene.add.graphics().setDepth(9000)
  const state: SceneFocus = { items: [], index: -1, ring }
  perScene.set(scene, state)

  const onKey = (event: KeyboardEvent) => {
    // Let the DOM inputs in Auth/CreateHero keep their normal typing behaviour.
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return

    switch (event.key) {
      case 'Tab':
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        move(state, event.key === 'Tab' && event.shiftKey ? -1 : 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        move(state, -1)
        break
      case 'Enter':
      case ' ':
        if (state.index >= 0 && state.items[state.index]) {
          event.preventDefault()
          state.items[state.index].activate()
        }
        break
      default:
    }
  }

  scene.input.keyboard?.on('keydown', onKey)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard?.off('keydown', onKey)
    perScene.delete(scene)
  })

  return state
}

/**
 * Makes a button reachable by keyboard. Buttons register themselves in creation
 * order, which reads top-to-bottom in every scene here, so Tab order matches
 * what the player sees without any per-scene wiring.
 */
export function registerFocusable(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  activate: () => void,
): void {
  ensure(scene).items.push({ target, activate })
}
