/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_ENABLE_CONSOLE_LOGS: string;
  readonly VITE_CSRF_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
