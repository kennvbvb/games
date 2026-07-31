import { en, type MessageKey } from './en'
import { th } from './th'

export type Locale = 'en' | 'th'

export const LOCALES: Locale[] = ['en', 'th']

/** Shown in the language picker, each in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = { en: 'English', th: 'ไทย' }

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, th }

let current: Locale = 'en'

export function getLocale(): Locale {
  return current
}

export function setLocale(locale: Locale): void {
  current = locale
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value)
}

/** Best guess from the browser, used only when a save has no choice recorded. */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.languages?.some((l) => l.toLowerCase().startsWith('th')) ? 'th' : 'en'
}

/**
 * Looks up a message and substitutes {placeholders}. Falls back to English if a
 * translation is missing, and to the key itself if it is unknown — a visible
 * key in the UI is a much better bug report than a blank label.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = DICTIONARIES[current][key] ?? en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export type { MessageKey }
