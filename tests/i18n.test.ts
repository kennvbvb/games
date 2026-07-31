import { describe, it, expect, beforeEach } from 'vitest'
import { en } from '../src/i18n/en'
import { th } from '../src/i18n/th'
import { LOCALES, getLocale, isLocale, setLocale, t } from '../src/i18n'
import { parsePlayerState } from '../src/state/validate'

describe('dictionaries', () => {
  beforeEach(() => setLocale('en'))

  it('translates every English key', () => {
    const missing = Object.keys(en).filter((key) => !(key in th))
    expect(missing).toEqual([])
  })

  it('has no stray keys in the Thai dictionary', () => {
    const extra = Object.keys(th).filter((key) => !(key in en))
    expect(extra).toEqual([])
  })

  it('leaves no Thai entry empty or untranslated-by-accident', () => {
    for (const [key, value] of Object.entries(th)) {
      expect(value.trim(), `th[${key}] is empty`).not.toBe('')
    }
  })

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort()
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(th[key]), `placeholders differ for ${key}`).toEqual(placeholders(en[key]))
    }
  })
})

describe('t()', () => {
  beforeEach(() => setLocale('en'))

  it('returns the message for the active locale', () => {
    expect(t('menu.shop')).toBe(en['menu.shop'])
    setLocale('th')
    expect(t('menu.shop')).toBe(th['menu.shop'])
  })

  it('substitutes named placeholders', () => {
    expect(t('stages.page', { current: 2, total: 3 })).toBe('Page 2 / 3')
    setLocale('th')
    expect(t('stages.page', { current: 2, total: 3 })).toContain('2')
  })

  it('leaves unknown placeholders untouched rather than printing undefined', () => {
    expect(t('stages.page', { current: 1 })).toBe('Page 1 / {total}')
  })

  it('handles a message used with no params', () => {
    expect(t('common.back')).toBe('Back')
  })
})

describe('locale selection', () => {
  beforeEach(() => setLocale('en'))

  it('recognises supported locales only', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true)
    for (const bad of ['fr', '', null, 3, 'EN ']) expect(isLocale(bad)).toBe(false)
  })

  it('round-trips through set/get', () => {
    setLocale('th')
    expect(getLocale()).toBe('th')
  })

  it('keeps a valid saved locale and rejects a bogus one', () => {
    expect(parsePlayerState({ name: 'S', level: 1, settings: { locale: 'th' } })!.settings.locale).toBe('th')
    const bogus = parsePlayerState({ name: 'S', level: 1, settings: { locale: 'klingon' } })!.settings.locale
    expect(LOCALES).toContain(bogus)
  })
})
