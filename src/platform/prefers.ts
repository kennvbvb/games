/**
 * Browser preference queries. Kept free of Phaser and of game state so both the
 * UI layer and the save layer can read them without depending on each other.
 */
export function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}
