import Phaser from 'phaser'
import { GAME_W, GAME_H, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { getSession, signIn, signUp, isSupabaseConfigured } from '../services/authService'
import { loadLocal, loadState } from '../services/saveService'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'

export class AuthScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text

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
      'padding:10px 14px;font-size:14px;border-radius:14px;border:2px solid #f3d9e5;background:#fff;color:#5d4a66;outline:none;font-family:inherit'
    const buttonStyle = (bg: string) =>
      `padding:10px;font-size:14px;font-weight:bold;cursor:pointer;border:none;border-radius:14px;background:${bg};color:#fff;font-family:inherit`
    const formHtml = `
      <div style="display:flex;flex-direction:column;gap:10px;width:240px;font-family:'Fredoka','Trebuchet MS',sans-serif;">
        <input type="email" id="email" placeholder="Email" autocomplete="email" style="${inputStyle}" />
        <input type="password" id="password" placeholder="Password" autocomplete="current-password" style="${inputStyle}" />
        <button id="signin" type="button" style="${buttonStyle('#ff8fab')}">Sign In</button>
        <button id="signup" type="button" style="${buttonStyle('#a78bfa')}">Sign Up</button>
        <button id="guest" type="button" style="padding:10px;font-size:14px;font-weight:bold;cursor:pointer;border:2px solid #ff8fab;border-radius:14px;background:#fff;color:#ff8fab;font-family:inherit">Continue as Guest</button>
      </div>
    `
    const dom = this.add.dom(GAME_W / 2, GAME_H / 2 + 60).createFromHTML(formHtml)

    const emailInput = dom.getChildByID('email') as HTMLInputElement
    const passwordInput = dom.getChildByID('password') as HTMLInputElement
    const signInBtn = dom.getChildByID('signin') as HTMLButtonElement
    const signUpBtn = dom.getChildByID('signup') as HTMLButtonElement
    const guestBtn = dom.getChildByID('guest') as HTMLButtonElement

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
      this.continueAsGuest()
    })

    void this.tryResumeSession()
  }

  private enterGame(): void {
    this.scene.start(GameState.player ? 'MainMenu' : 'CreateHero')
  }

  private async tryResumeSession(): Promise<void> {
    const session = await getSession()
    if (session?.user) {
      GameState.userId = session.user.id
      GameState.player = await loadState(session.user.id)
      this.enterGame()
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
        GameState.userId = session.user.id
        GameState.player = await loadState(session.user.id)
        this.enterGame()
      } else {
        this.statusText.setColor(COLORS.textDim)
        this.statusText.setText('Check your email to confirm your account, then sign in')
      }
    } catch (err) {
      this.statusText.setColor(COLORS.danger)
      this.statusText.setText(err instanceof Error ? err.message : 'Authentication failed')
    }
  }

  private continueAsGuest(): void {
    GameState.userId = null
    GameState.player = loadLocal()
    this.enterGame()
  }
}
