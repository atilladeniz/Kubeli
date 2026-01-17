"use client";

// Monaco configuration for Tauri - only runs in browser
if (typeof window !== "undefined") {
  // Dynamically import and configure Monaco only on client side
  import("@monaco-editor/react").then(({ loader }) => {
    import("monaco-editor").then((monaco) => {
      loader.config({ monaco });
    });
  });
}
