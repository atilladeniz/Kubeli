/// <reference types="vite/client" />

// edcore.main ships no .d.ts; it exposes the same API surface as editor.api
// (full editor, no language services).
declare module "monaco-editor/esm/vs/editor/edcore.main" {
  export * from "monaco-editor/esm/vs/editor/editor.api";
}
