/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL?: string
  readonly VITE_XAI_API_KEY?: string
  readonly VITE_GROK_TTS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
