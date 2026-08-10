/// <reference types="vite/client" />

// edcore.main ships no .d.ts; it exposes the same API surface as editor.api
// (full editor, no language services).
// monaco 0.56 resolves subpaths through its exports map; these entrypoints
// ship no .d.ts of their own.
declare module "monaco-editor/editor/editor.api.js" {
  export * from "monaco-editor/esm/vs/editor/editor.api";
}
declare module "monaco-editor/languages/definitions/yaml/register.js";
declare module "monaco-editor/editor/editor.worker.js";
