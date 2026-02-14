import type { ShellOptions } from "../../types";

import { invoke } from "./core";

// Shell commands
export async function shellStart(
  sessionId: string,
  options: ShellOptions
): Promise<void> {
  return invoke("shell_start", { sessionId, options });
}

export async function shellSendInput(
  sessionId: string,
  input: string
): Promise<void> {
  return invoke("shell_send_input", { sessionId, input });
}

export async function shellResize(
  sessionId: string,
  cols: number,
  rows: number
): Promise<void> {
  return invoke("shell_resize", { sessionId, cols, rows });
}

export async function shellClose(sessionId: string): Promise<void> {
  return invoke("shell_close", { sessionId });
}

export async function shellListSessions(): Promise<string[]> {
  return invoke<string[]>("shell_list_sessions");
}
