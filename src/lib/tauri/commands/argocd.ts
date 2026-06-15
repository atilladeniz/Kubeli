import type {
  ArgoCDApplicationInfo,
  ArgoCDHistoryEntry,
  ArgoCDOperationState,
} from "../../types";

import { invoke } from "./core";

// ArgoCD commands
export async function listArgoCDApplications(
  namespace?: string
): Promise<ArgoCDApplicationInfo[]> {
  return invoke<ArgoCDApplicationInfo[]>("list_argocd_applications", { namespace });
}

export async function refreshArgoCDApplication(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("refresh_argocd_application", { name, namespace });
}

export async function hardRefreshArgoCDApplication(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("hard_refresh_argocd_application", { name, namespace });
}

export async function syncArgoCDApplication(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("sync_argocd_application", { name, namespace });
}

export async function getArgoCDApplicationHistory(
  name: string,
  namespace: string
): Promise<ArgoCDHistoryEntry[]> {
  return invoke<ArgoCDHistoryEntry[]>("get_argocd_application_history", { name, namespace });
}

export async function rollbackArgoCDApplication(
  name: string,
  namespace: string,
  id: number
): Promise<void> {
  return invoke<void>("rollback_argocd_application", { name, namespace, id });
}

export async function getArgoCDOperationState(
  name: string,
  namespace: string
): Promise<ArgoCDOperationState> {
  return invoke<ArgoCDOperationState>("get_argocd_operation_state", {
    name,
    namespace,
  });
}
