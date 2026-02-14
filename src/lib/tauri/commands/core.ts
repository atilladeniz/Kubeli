import { invoke as tauriInvoke } from "@tauri-apps/api/core";

import { mockInvoke } from "../mock";

export const invoke = <T>(command: string, payload?: unknown): Promise<T> => {
  if (process.env.VITE_TAURI_MOCK === "true") {
    return mockInvoke(
      command,
      payload as Record<string, unknown> | undefined
    ) as Promise<T>;
  }

  return tauriInvoke<T>(command, payload as Record<string, unknown> | undefined);
};
