import Phaser from 'phaser'
import { GameState } from '../state/GameState'
import { createDefaultPlayerState } from '../state/playerState'
import { getSession, signIn, signUp, isSupabaseConfigured } from '../services/authService'
import { loadLocal, loadState } from '../services/saveService'
import { COLORS } from '../ui/styles'

export class AuthScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text

  constructor() {
    super('Auth')
  }

  create(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, 80, 'Incremental RPG', { fontSize: '32px', color: COLORS.text })
      .setOrigin(0.5)

    this.statusText = this.add
      .text(width / 2, height - 40, '', { fontSize: '14px', color: COLORS.danger, wordWrap: { width: width - 40 }, align: 'center' })
      .setOrigin(0.5)

    if (!isSupabaseConfigured) {
      this.statusText.setColor(COLORS.textDim)
      this.statusText.setText('Cloud accounts are not configured — guest mode only')
    }

    const formHtml = `
      <div style="display:flex;flex-direction:column;gap:8px;width:220px;font-family:sans-serif;">
        <input type="email" id="email" placeholder="Email" autocomplete="email" style="padding:8px;font-size:14px" />
        <input type="password" id="password" placeholder="Password" autocomplete="current-password" style="padding:8px;font-size:14px" />
        <button id="signin" type="button" style="padding:8px;font-size:14px;cursor:pointer">Sign In</button>
        <button id="signup" type="button" style="padding:8px;font-size:14px;cursor:pointer">Sign Up</button>
        <button id="guest" type="button" style="padding:8px;font-size:14px;cursor:pointer">Continue as Guest</button>
      </div>
    `
    const dom = this.add.dom(width / 2, height / 2).createFromHTML(formHtml)

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
      void this.continueAsGuest()
    })

    void this.tryResumeSession()
  }

  private async tryResumeSession(): Promise<void> {
    const session = await getSession()
    if (session?.user) {
      await this.enterGameWithUser(session.user.id)
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
        await this.enterGameWithUser(session.user.id)
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
    GameState.player = loadLocal() ?? createDefaultPlayerState()
    this.scene.start('MainMenu')
  }

  private async enterGameWithUser(userId: string): Promise<void> {
    GameState.userId = userId
    GameState.player = (await loadState(userId)) ?? createDefaultPlayerState()
    this.scene.start('MainMenu')
  }
}
