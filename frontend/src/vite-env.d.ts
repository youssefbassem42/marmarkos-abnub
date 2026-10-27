/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The API base URL; see .env.example. */
  readonly VITE_API_BASE_URL?: string;
  /** The Google Identity Services client id. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /**
   * Where the access token is kept: `memory` (default), `session` or
   * `local`. See src/lib/auth.ts.
   */
  readonly VITE_AUTH_PERSISTENCE?: "memory" | "session" | "local";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
