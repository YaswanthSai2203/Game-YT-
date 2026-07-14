/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEADERBOARD_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
