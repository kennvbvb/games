import Phaser from 'phaser'
import { GAME_W, GAME_H, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { getSession, signIn, signUp, isSupabaseConfigured } from '../services/authService'
import { loadState, hasGuestSave, importGuestSave } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'

export class AuthScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text
  private form!: Phaser.GameObjects.DOMElement

  constructor() {
    super('Auth')
  }

  create(): void {
    setupScene(this)

    const mascot = makeEmoji(this, GAME_W / 2, 100, 'avatar_cat', 70)
    this.tweens.add({ targets: mascot, y: 92, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    makeTitle(this, 160, 'Incremental RPG', 'icon_blossom', { fontSize: '29px', iconSize: 22, flank: true })
    this.add
      .text(GAME_W / 2, 194, 'Train your hero and clear every stage!', {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    this.statusText = this.add
      .text(GAME_W / 2, GAME_H - 40, '', {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.danger,
        wordWrap: { width: GAME_W - 40 },
        align: 'center',
      })
      .setOrigin(0.5)

    if (!isSupabaseConfigured) {
      this.statusText.setColor(COLORS.textDim)
      this.statusText.setText('Cloud accounts are not configured — guest mode only')
    }

    const inputStyle =
      'padding:12px 14px;font-size:16px;border-radius:14px;border:2px solid #f3d9e5;background:#fff;color:#5d4a66;outline:none;font-family:inherit'
    const buttonStyle = (bg: string) =>
      `padding:14px;font-size:16px;font-weight:bold;cursor:pointer;border:none;border-radius:14px;background:${bg};color:#fff;font-family:inherit`
    const formHtml = `
      <div style="display:flex;flex-direction:column;gap:10px;width:250px;font-family:'Fredoka','Trebuchet MS',sans-serif;">
        <input type="email" id="email" placeholder="Email" autocomplete="email" style="${inputStyle}" />
        <input type="password" id="password" placeholder="Password" autocomplete="current-password" style="${inputStyle}" />
        <button id="signin" type="button" style="${buttonStyle('#ff8fab')}">Sign In</button>
        <button id="signup" type="button" style="${buttonStyle('#a78bfa')}">Sign Up</button>
        <button id="guest" type="button" style="padding:14px;font-size:16px;font-weight:bold;cursor:pointer;border:2px solid #ff8fab;border-radius:14px;background:#fff;color:#ff8fab;font-family:inherit">Continue as Guest</button>
      </div>
    `
    this.form = this.add.dom(GAME_W / 2, GAME_H / 2 + 60).createFromHTML(formHtml)

    const emailInput = this.form.getChildByID('email') as HTMLInputElement
    const passwordInput = this.form.getChildByID('password') as HTMLInputElement
    const signInBtn = this.form.getChildByID('signin') as HTMLButtonElement
    const signUpBtn = this.form.getChildByID('signup') as HTMLButtonElement
    const guestBtn = this.form.getChildByID('guest') as HTMLButtonElement

    if (!isSupabaseConfigured) {
      signInBtn.disabled = true
      signUpBtn.disabled = true
    }

    signInBtn.addEventListener('click', () => {
      void this.handleAuth('signin', emailInput.value, passwordInput.value)
    })
    signUpBtn.addEventListener('click', () => {
      void this.handleAuth('signup', emailInput.value, passwordInput.value)
    })
    guestBtn.addEventListener('click', () => {
      void this.continueAsGuest()
    })

    void this.tryResumeSession()
  }

  private async enterWithUser(userId: string): Promise<void> {
    GameState.userId = userId
    GameState.player = await loadState(userId)
    if (GameState.player) {
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
      .text(GAME_W / 2, GAME_H / 2 - 40, 'Welcome!', {
        fontSize: '22px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 4, 'There is guest progress saved on this device.\nBring it into your account?', {
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
      'Import guest progress',
      () => {
        void importGuestSave(userId).then((state) => {
          GameState.player = state
          this.scene.start(state ? 'MainMenu' : 'CreateHero')
        })
      },
      { minWidth: 280 },
    )
    makeButton(this, GAME_W / 2, GAME_H / 2 + 126, 'Start fresh', () => this.scene.start('CreateHero'), {
      variant: 'secondary',
      fontSize: '15px',
      minWidth: 280,
    })
  }

  private async tryResumeSession(): Promise<void> {
    const session = await getSession()
    if (session?.user) {
      await this.enterWithUser(session.user.id)
    }
  }

  private async handleAuth(mode: 'signin' | 'signup', email: string, password: string): Promise<void> {
    if (!email || !password) {
      this.statusText.setColor(COLORS.danger)
      this.statusText.setText('Enter an email and password')
      return
    }
    try {
      const session = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
      if (session?.user) {
        await this.enterWithUser(session.user.id)
      } else {
        this.statusText.setColor(COLORS.textDim)
        this.statusText.setText('Check your email to confirm your account, then sign in')
      }
    } catch (err) {
      this.statusText.setColor(COLORS.danger)
      this.statusText.setText(err instanceof Error ? err.message : 'Authentication failed')
    }
  }

  private async continueAsGuest(): Promise<void> {
    GameState.userId = null
    GameState.player = await loadState(null)
    this.scene.start(GameState.player ? 'MainMenu' : 'CreateHero')
  }
}
