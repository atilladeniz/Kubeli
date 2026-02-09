"use client";

import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { configureMonacoYaml } from "monaco-yaml";

// Monaco configuration for Tauri - only runs in browser
if (typeof window !== "undefined") {
  // Set up worker routing before Monaco loads
  window.MonacoEnvironment = {
    getWorker(_, label) {
      switch (label) {
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

  // Configure YAML language support with K8s schema validation
  configureMonacoYaml(monaco, {
    isKubernetes: true,
    enableSchemaRequest: true,
    validate: true,
    completion: true,
    hover: true,
    format: true,
  });
}
