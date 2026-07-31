/** Avatar ids double as the `avatar_<id>` emoji texture key. */
export const AVATAR_IDS = ['cat', 'dog', 'fox', 'rabbit', 'panda', 'frog'] as const

export type AvatarId = (typeof AVATAR_IDS)[number]

export const DEFAULT_AVATAR: AvatarId = 'cat'

/** Saves written before avatars became texture keys stored the raw emoji. */
const LEGACY_EMOJI_TO_ID: Record<string, AvatarId> = {
  '🐱': 'cat',
  '🐶': 'dog',
  '🦊': 'fox',
  '🐰': 'rabbit',
  '🐼': 'panda',
  '🐸': 'frog',
}

export function normalizeAvatar(value: unknown): AvatarId {
  if (typeof value !== 'string') return DEFAULT_AVATAR
  if ((AVATAR_IDS as readonly string[]).includes(value)) return value as AvatarId
  return LEGACY_EMOJI_TO_ID[value] ?? DEFAULT_AVATAR
}
