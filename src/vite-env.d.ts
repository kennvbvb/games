/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Opt-in Admin Test Lab; only honoured alongside import.meta.env.DEV. */
  readonly VITE_ENABLE_DEV_ADMIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
