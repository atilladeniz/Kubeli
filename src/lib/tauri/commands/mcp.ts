import { invoke } from "./core";

// MCP Server commands
export interface McpIdeInfo {
  id: string;
  name: string;
  installed: boolean;
  config_path: string | null;
  mcp_configured: boolean;
}

export async function mcpDetectIdes(): Promise<McpIdeInfo[]> {
  return invoke<McpIdeInfo[]>("mcp_detect_ides");
}

export async function mcpInstallIde(ideId: string): Promise<void> {
  return invoke<void>("mcp_install_ide", { ideId });
}

export async function mcpUninstallIde(ideId: string): Promise<void> {
  return invoke<void>("mcp_uninstall_ide", { ideId });
}

export async function mcpGetKubeliPath(): Promise<string> {
  return invoke<string>("mcp_get_kubeli_path");
}
