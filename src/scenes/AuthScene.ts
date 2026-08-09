import Phaser from 'phaser'
import { GAME_W, GAME_H, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import {
  getSession,
  isSupabaseConfigured,
  onAuthStateChange,
  requestPasswordReset,
  resendConfirmation,
  signIn,
  signUp,
  updatePassword,
} from '../services/authService'
import {
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  canSubmit,
  fieldsFor,
  validateAuthForm,
} from '../services/authForm'
import { resolveAdminGrant } from '../admin/AdminAccess'
import { loadState, hasGuestSave, importGuestSave } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makeDom } from '../ui/components/makeDom'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { ambientTween } from '../ui/motion'
import { COLORS, FONT } from '../ui/styles'
import { t } from '../i18n'
import type { AuthFields, AuthMode } from '../services/authForm'
import type { ConflictSceneData } from './ConflictScene'

interface AuthSceneData {
  mode?: AuthMode
  /** Carried across a mode switch so the player does not retype their address. */
  email?: string
  /** Shown once on arrival, e.g. after a reset mail is sent. */
  notice?: string
}

const INPUT_STYLE =
  'padding:12px 14px;font-size:16px;border-radius:14px;border:2px solid #f3d9e5;background:#fff;color:#5d4a66;outline:none;font-family:inherit'

function buttonStyle(bg: string): string {
  return `padding:14px;font-size:16px;font-weight:bold;cursor:pointer;border:none;border-radius:14px;background:${bg};color:#fff;font-family:inherit`
}

const LINK_STYLE =
  'padding:6px;font-size:13px;cursor:pointer;border:none;background:transparent;color:#a78bfa;font-family:inherit;text-decoration:underline'

/**
 * Sign in, sign up, forgotten password and reset — four modes on one screen.
 *
 * One scene rather than four because they share every part that is fiddly: the
 * DOM form, the busy guard, the status line, and what happens once a session
 * exists. Splitting them would mean four copies of the double-submit guard, and
 * the copy that got forgotten would be the bug.
 */
export class AuthScene extends Phaser.Scene {
  private mode: AuthMode = 'signin'
  private initialEmail = ''
  private notice = ''

  private statusText!: Phaser.GameObjects.Text
  private form!: Phaser.GameObjects.DOMElement
  /**
   * True while a request is in flight. Checked *before* the request rather than
   * relying on the disabled attribute, because a second tap can land before the
   * browser has repainted the button.
   */
  private busy = false
  private stopWatching: (() => void) | null = null
  /** Set once the account is entered, so a late auth event cannot re-enter. */
  private entered = false

  constructor() {
    super('Auth')
  }

  init(data: AuthSceneData): void {
    this.mode = data.mode ?? 'signin'
    this.initialEmail = data.email ?? ''
    this.notice = data.notice ?? ''
    this.busy = false
    this.entered = false
  }

  create(): void {
    setupScene(this)

    const mascot = makeEmoji(this, GAME_W / 2, 92, 'avatar_cat', 62)
    ambientTween(this, { targets: mascot, y: 84, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    makeTitle(this, 146, t('app.title'), 'icon_blossom', { fontSize: '27px', iconSize: 21, flank: true })
    this.add
      .text(GAME_W / 2, 178, this.subtitle(), {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: GAME_W - 60 },
      })
      .setOrigin(0.5)

    this.statusText = this.add
      .text(GAME_W / 2, GAME_H - 38, '', {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.danger,
        wordWrap: { width: GAME_W - 40 },
        align: 'center',
      })
      .setOrigin(0.5)

    if (this.notice) this.say(this.notice, COLORS.textDim)
    else if (!isSupabaseConfigured) this.say(t('auth.cloudUnavailable'), COLORS.textDim)

    this.buildForm()

    // Torn down on shutdown; a scene that restarts without this accumulates a
    // listener per restart, and every one of them fires on the next change.
    this.stopWatching = onAuthStateChange((change, session) => {
      if (change === 'recovery') {
        this.scene.restart({ mode: 'reset' } satisfies AuthSceneData)
      } else if (change === 'signed-in' && session?.user && !this.entered && this.mode !== 'reset') {
        void this.enterWithUser(session.user)
      }
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopWatching?.()
      this.stopWatching = null
    })

    // A recovery link is opened *before* the listener above can exist, so the
    // session may already be a recovery one by the time this scene runs.
    if (this.mode !== 'reset') void this.tryResumeSession()
  }

  private subtitle(): string {
    if (this.mode === 'forgot') return t('auth.forgotHint')
    if (this.mode === 'reset') return t('auth.resetHint')
    return t('app.tagline')
  }

  private say(message: string, colour: string = COLORS.danger): void {
    this.statusText.setColor(colour)
    this.statusText.setText(message)
  }

  private buildForm(): void {
    const asks = fieldsFor(this.mode)
    const rows: string[] = []

    if (asks.email) {
      rows.push(
        `<input type="email" id="email" placeholder="${t('auth.email')}" autocomplete="email" inputmode="email" value="${this.initialEmail}" style="${INPUT_STYLE}" />`,
      )
    }
    if (asks.password) {
      const autocomplete = this.mode === 'signin' ? 'current-password' : 'new-password'
      rows.push(
        `<input type="password" id="password" placeholder="${t('auth.password')}" autocomplete="${autocomplete}" style="${INPUT_STYLE}" />`,
      )
    }
    if (asks.confirm) {
      rows.push(
        `<input type="password" id="confirm" placeholder="${t('auth.confirmPassword')}" autocomplete="new-password" style="${INPUT_STYLE}" />`,
      )
    }

    if (this.mode === 'signin') {
      rows.push(`<button id="primary" type="button" style="${buttonStyle('#ff8fab')}">${t('auth.signIn')}</button>`)
      rows.push(`<button id="secondary" type="button" style="${buttonStyle('#a78bfa')}">${t('auth.signUp')}</button>`)
      rows.push(
        `<button id="guest" type="button" style="padding:14px;font-size:16px;font-weight:bold;cursor:pointer;border:2px solid #ff8fab;border-radius:14px;background:#fff;color:#ff8fab;font-family:inherit">${t('auth.guest')}</button>`,
      )
      rows.push(`<button id="forgot" type="button" style="${LINK_STYLE}">${t('auth.forgot')}</button>`)
    } else if (this.mode === 'signup') {
      rows.push(`<button id="primary" type="button" style="${buttonStyle('#a78bfa')}">${t('auth.signUp')}</button>`)
      rows.push(`<button id="back" type="button" style="${LINK_STYLE}">${t('auth.backToSignIn')}</button>`)
    } else if (this.mode === 'forgot') {
      rows.push(`<button id="primary" type="button" style="${buttonStyle('#ff8fab')}">${t('auth.sendReset')}</button>`)
      rows.push(`<button id="resend" type="button" style="${LINK_STYLE}">${t('auth.resend')}</button>`)
      rows.push(`<button id="back" type="button" style="${LINK_STYLE}">${t('auth.backToSignIn')}</button>`)
    } else {
      rows.push(
        `<button id="primary" type="button" style="${buttonStyle('#ff8fab')}">${t('auth.savePassword')}</button>`,
      )
    }

    const html = `<div style="display:flex;flex-direction:column;gap:10px;width:250px;font-family:'Fredoka','Trebuchet MS',sans-serif;">${rows.join('')}</div>`
    this.form = makeDom(this, GAME_W / 2, GAME_H / 2 + 96, html)

    // Without a server, disable exactly the controls that would call one —
    // `primary` and `resend`. Navigation stays live: a player who taps "Forgot
    // password?" and lands on a screen that explains why it is unavailable has
    // learned something, where a dead grey link with no destination teaches
    // nothing. Guest play stays live too, which is the whole reason the game
    // still works with no configuration at all.
    if (!isSupabaseConfigured) {
      this.setEnabled('primary', false)
      this.setEnabled('resend', false)
    }

    this.el('primary')?.addEventListener('click', () => void this.submit())
    this.el('secondary')?.addEventListener('click', () =>
      this.scene.restart({ mode: 'signup', email: this.value('email') } satisfies AuthSceneData),
    )
    this.el('forgot')?.addEventListener('click', () =>
      this.scene.restart({ mode: 'forgot', email: this.value('email') } satisfies AuthSceneData),
    )
    this.el('back')?.addEventListener('click', () =>
      this.scene.restart({ mode: 'signin', email: this.value('email') } satisfies AuthSceneData),
    )
    this.el('resend')?.addEventListener('click', () => void this.resend())
    this.el('guest')?.addEventListener('click', () => void this.continueAsGuest())

    // Enter submits, which is what every other form on the web does.
    for (const id of ['email', 'password', 'confirm']) {
      this.el(id)?.addEventListener('keydown', (ev) => {
        if ((ev as KeyboardEvent).key === 'Enter') void this.submit()
      })
    }
  }

  private el(id: string): HTMLInputElement & HTMLButtonElement {
    return this.form.getChildByID(id) as HTMLInputElement & HTMLButtonElement
  }

  private value(id: string): string {
    return this.el(id)?.value ?? ''
  }

  private fields(): AuthFields {
    return { email: this.value('email'), password: this.value('password'), confirm: this.value('confirm') }
  }

  /**
   * Disables a control and *shows* that it is disabled.
   *
   * A native button greys itself out; one with a custom background does not, so
   * a disabled button here looked exactly like a live one. The player taps it,
   * nothing happens, and there is nothing on screen to explain why.
   */
  private setEnabled(id: string, enabled: boolean): void {
    const el = this.el(id)
    if (!el) return
    el.disabled = !enabled
    el.style.opacity = enabled ? '1' : '0.45'
    el.style.cursor = enabled ? 'pointer' : 'not-allowed'
  }

  /** Disables every control while a request is out, and says so. */
  private setBusy(busy: boolean): void {
    this.busy = busy
    for (const id of ['primary', 'secondary', 'forgot', 'back', 'resend', 'guest']) {
      this.setEnabled(id, !busy)
    }
    if (busy) this.say(t('auth.working'), COLORS.textDim)
  }

  private async submit(): Promise<void> {
    const fields = this.fields()
    const fault = validateAuthForm(this.mode, fields)
    if (fault) {
      this.say(t(fault.messageKey, { min: MIN_PASSWORD_LENGTH }))
      this.el(fault.field)?.focus()
      return
    }
    if (!canSubmit(this.mode, fields, this.busy)) return

    this.setBusy(true)
    try {
      if (this.mode === 'forgot') {
        await requestPasswordReset(fields.email)
        // Deliberately the same message whether or not the address has an
        // account: saying "no such account" turns this form into a way to ask
        // which addresses are registered.
        this.scene.restart({
          mode: 'signin',
          email: fields.email,
          notice: t('auth.resetSent'),
        } satisfies AuthSceneData)
        return
      }

      if (this.mode === 'reset') {
        await updatePassword(fields.password)
        this.say(t('auth.resetDone'), COLORS.textDim)
        const session = await getSession()
        if (session?.user) await this.enterWithUser(session.user)
        else this.scene.restart({ mode: 'signin' } satisfies AuthSceneData)
        return
      }

      const session =
        this.mode === 'signin'
          ? await signIn(fields.email, fields.password)
          : await signUp(fields.email, fields.password)

      if (session?.user) {
        await this.enterWithUser(session.user)
      } else {
        // Sign-up with confirmation on: no session until the mail is opened.
        this.scene.restart({
          mode: 'forgot',
          email: fields.email,
          notice: t('auth.confirmEmail'),
        } satisfies AuthSceneData)
      }
    } catch (err) {
      this.say(authErrorMessage(err, t('auth.failed')))
      this.setBusy(false)
    }
  }

  private async resend(): Promise<void> {
    const email = this.value('email')
    const fault = validateAuthForm('forgot', { email, password: '', confirm: '' })
    if (fault) {
      this.say(t(fault.messageKey, { min: MIN_PASSWORD_LENGTH }))
      return
    }
    if (this.busy) return

    this.setBusy(true)
    try {
      await resendConfirmation(email)
      this.say(t('auth.resendSent'), COLORS.textDim)
    } catch (err) {
      this.say(authErrorMessage(err, t('auth.failed')))
    }
    this.setBusy(false)
  }

  private async enterWithUser(user: { id: string }): Promise<void> {
    if (this.entered) return
    this.entered = true
    const userId = user.id
    GameState.userId = userId
    // Resolved once, from the session the server issued. A dev build resolves
    // the same way with no session at all; see admin/AdminAccess.
    GameState.adminGrant = resolveAdminGrant({ user })
    const { state, conflict } = await loadState(userId)
    GameState.player = state
    if (conflict) {
      // Two devices played on from the same point; only the player can choose.
      this.scene.start('Conflict', conflict satisfies ConflictSceneData)
    } else if (GameState.player) {
      this.scene.start('MainMenu')
    } else if (hasGuestSave()) {
      this.showImportChoice(userId)
    } else {
      this.scene.start('CreateHero')
    }
  }

  /**
   * A signed-in account with no save of its own never silently adopts the
   * guest save — the player decides whether to bring that progress along.
   */
  private showImportChoice(userId: string): void {
    this.form.setVisible(false)
    this.statusText.setText('')

    makePanel(this, GAME_W / 2, GAME_H / 2 + 40, 400, 240)
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 40, t('auth.welcome'), {
        fontSize: '22px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 4, t('auth.importPrompt'), {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
      })
      .setOrigin(0.5)

    makeButton(
      this,
      GAME_W / 2,
      GAME_H / 2 + 62,
      t('auth.import'),
      () => {
        void importGuestSave(userId).then((state) => {
          GameState.player = state
          this.scene.start(state ? 'MainMenu' : 'CreateHero')
        })
      },
      { minWidth: 280 },
    )
    makeButton(this, GAME_W / 2, GAME_H / 2 + 126, t('auth.startFresh'), () => this.scene.start('CreateHero'), {
      variant: 'secondary',
      fontSize: '15px',
      minWidth: 280,
    })
  }

  private async tryResumeSession(): Promise<void> {
    const session = await getSession()
    if (session?.user) await this.enterWithUser(session.user)
  }

  private async continueAsGuest(): Promise<void> {
    if (this.busy) return
    GameState.userId = null
    GameState.adminGrant = resolveAdminGrant(null)
    GameState.player = (await loadState(null)).state
    this.scene.start(GameState.player ? 'MainMenu' : 'CreateHero')
  }
}
