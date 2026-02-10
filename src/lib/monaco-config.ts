"use client";

import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { parseDocument } from "yaml";

// Editor worker wrapper — Vite ?worker import for reliable bundling
import EditorWorker from "@/lib/workers/editor.worker?worker";

// Monaco configuration for Tauri — only runs in browser
if (typeof window !== "undefined") {
  window.MonacoEnvironment = {
    getWorker() {
      return new EditorWorker();
    },
  };

  // Configure loader to use local monaco-editor (not CDN)
  loader.config({ monaco });
}

/** Validate YAML content and set Monaco markers. */
function validateYamlModel(model: editor.ITextModel, monacoInstance: Monaco) {
  const content = model.getValue();
  if (!content.trim()) {
    monacoInstance.editor.setModelMarkers(model, "yaml", []);
    return;
  }

  const doc = parseDocument(content, { prettyErrors: true });
  const markers: editor.IMarkerData[] = [];

  for (const error of doc.errors) {
    const start = error.linePos?.[0] ?? { line: 1, col: 1 };
    const end = error.linePos?.[1] ?? start;
    markers.push({
      severity: monacoInstance.MarkerSeverity.Error,
      message: error.message.split("\n")[0],
      startLineNumber: start.line,
      startColumn: start.col,
      endLineNumber: end.line,
      endColumn: end.col + 1,
      source: "yaml",
    });
  }

  for (const warning of doc.warnings) {
    const start = warning.linePos?.[0] ?? { line: 1, col: 1 };
    const end = warning.linePos?.[1] ?? start;
    markers.push({
      severity: monacoInstance.MarkerSeverity.Warning,
      message: warning.message.split("\n")[0],
      startLineNumber: start.line,
      startColumn: start.col,
      endLineNumber: end.line,
      endColumn: end.col + 1,
      source: "yaml",
    });
  }

  monacoInstance.editor.setModelMarkers(model, "yaml", markers);
}

/**
 * Set up debounced YAML validation on a Monaco editor instance.
 * Call from the Editor's onMount callback.
 * Returns a dispose function to clean up the content-change listener.
 */
export function setupYamlValidation(
  editorInstance: editor.IStandaloneCodeEditor,
  monacoInstance: Monaco,
): () => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const validate = () => {
    const model = editorInstance.getModel();
    if (model) validateYamlModel(model, monacoInstance);
  };

  const disposable = editorInstance.onDidChangeModelContent(() => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(validate, 300);
  });

  // Run initial validation
  validate();

  return () => {
    disposable.dispose();
    if (timeout) clearTimeout(timeout);
  };
}
