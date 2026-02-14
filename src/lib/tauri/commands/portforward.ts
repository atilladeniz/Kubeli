import type { PortForwardInfo, PortForwardOptions } from "../../types";

import { invoke } from "./core";

// Port forward commands
export async function portforwardStart(
  forwardId: string,
  options: PortForwardOptions
): Promise<PortForwardInfo> {
  return invoke<PortForwardInfo>("portforward_start", { forwardId, options });
}

export async function portforwardStop(forwardId: string): Promise<void> {
  return invoke("portforward_stop", { forwardId });
}

export async function portforwardList(): Promise<PortForwardInfo[]> {
  return invoke<PortForwardInfo[]>("portforward_list");
}

export async function portforwardGet(
  forwardId: string
): Promise<PortForwardInfo | null> {
  return invoke<PortForwardInfo | null>("portforward_get", { forwardId });
}

export async function portforwardCheckPort(port: number): Promise<boolean> {
  return invoke<boolean>("portforward_check_port", { port });
}
