import Phaser from 'phaser'
import { RENDER_SCALE } from '../../config/layout'

/**
 * Adds a DOM overlay element centred on `(x, y)` in the game's logical space.
 *
 * Phaser positions a DOM element by writing `translate(anchor * RENDER_SCALE -
 * size, …)` and then scaling it about its own centre, which lands the centre at
 * `anchor * RENDER_SCALE - size / 2` rather than at `anchor * RENDER_SCALE`.
 * Every DOM element in the game therefore sits up and to the left by a quarter
 * of its own size — measured at 250px wide (the auth form) and 360px wide (the
 * admin import box), the error was exactly 125 and 180 container pixels.
 *
 * The correction is a quarter of the element's own unscaled size added to the
 * anchor, which is viewport-independent: the error is in the container's own
 * pixels, and the container is then scaled uniformly onto the canvas.
 *
 * Elements must therefore carry an explicit width — a node the browser has not
 * laid out yet measures zero, and the correction would be zero with it.
 */
export function makeDom(
  scene: Phaser.Scene,
  x: number,
  y: number,
  html: string,
): Phaser.GameObjects.DOMElement {
  const dom = scene.add.dom(x, y).createFromHTML(html)
  const node = dom.node as HTMLElement
  dom.setPosition(x + node.offsetWidth / (2 * RENDER_SCALE), y + node.offsetHeight / (2 * RENDER_SCALE))
  return dom
}
