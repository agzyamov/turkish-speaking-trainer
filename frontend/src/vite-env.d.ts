/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Release version of a production build, set by the deploy job (ADR-0011). */
  readonly VITE_APP_VERSION?: string;
}
