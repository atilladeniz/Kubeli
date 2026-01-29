import type { CliInfo, McpIdeInfo } from "@/lib/tauri/commands";

export interface SettingSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export interface CliStatusCardTranslations {
  authenticated: string;
  notAuthenticated: string;
  notInstalled: string;
  checking: string;
  clickRefresh: string;
  active: string;
}

export interface CliStatusCardProps {
  name: string;
  info: CliInfo | null;
  isChecking: boolean;
  isSelected: boolean;
  installInstructions: React.ReactNode;
  translations?: CliStatusCardTranslations;
}

export interface McpIdeCardTranslations {
  installed: string;
  notInstalled: string;
  notDetected: string;
  install: string;
  uninstall: string;
  installing: string;
}

export interface McpIdeCardProps {
  ide: McpIdeInfo;
  isInstalling: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  translations: McpIdeCardTranslations;
}
