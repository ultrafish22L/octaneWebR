/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG?: string;
  readonly VITE_INFO?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
