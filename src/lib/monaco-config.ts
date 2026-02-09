"use client";

import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { configureMonacoYaml } from "monaco-yaml";
import type { Monaco } from "@monaco-editor/react";

// Monaco configuration for Tauri - only runs in browser
if (typeof window !== "undefined") {
  // Set up worker routing before Monaco loads
  window.MonacoEnvironment = {
    getWorker(workerIdOrLabel, label) {
      // Monaco can call getWorker with either (label) or (workerId, label)
      const workerLabel = typeof label === "string" ? label : workerIdOrLabel;
      switch (workerLabel) {
        case "yaml":
          return new Worker(
            new URL("monaco-yaml/yaml.worker.js", import.meta.url),
            { type: "module" }
          );
        default:
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/editor/editor.worker.js",
              import.meta.url
            ),
            { type: "module" }
          );
      }
    },
  };

  // Configure loader to use local monaco-editor (not CDN)
  loader.config({ monaco });
}

const configuredMonacoInstances = new WeakSet<object>();

export function configureYamlLanguage(monacoInstance: Monaco) {
  const key = monacoInstance as unknown as object;
  if (configuredMonacoInstances.has(key)) {
    return;
  }

  configureMonacoYaml(monacoInstance, {
    isKubernetes: true,
    enableSchemaRequest: true,
    validate: true,
    completion: true,
    hover: true,
    format: true,
  });

  configuredMonacoInstances.add(key);
  (window as Window & { __KUBELI_MONACO__?: Monaco }).__KUBELI_MONACO__ = monacoInstance;
}
