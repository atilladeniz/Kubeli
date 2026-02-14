import type {
  HelmReleaseDetail,
  HelmReleaseHistoryEntry,
  HelmReleaseInfo,
} from "../../types";

import { invoke } from "./core";

// Helm commands
export async function listHelmReleases(namespace?: string): Promise<HelmReleaseInfo[]> {
  return invoke<HelmReleaseInfo[]>("list_helm_releases", { namespace });
}

export async function getHelmRelease(
  name: string,
  namespace: string,
  revision?: number
): Promise<HelmReleaseDetail> {
  return invoke<HelmReleaseDetail>("get_helm_release", {
    name,
    namespace,
    revision,
  });
}

export async function getHelmReleaseHistory(
  name: string,
  namespace: string
): Promise<HelmReleaseHistoryEntry[]> {
  return invoke<HelmReleaseHistoryEntry[]>("get_helm_release_history", {
    name,
    namespace,
  });
}

export async function getHelmReleaseValues(
  name: string,
  namespace: string,
  revision?: number
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("get_helm_release_values", {
    name,
    namespace,
    revision,
  });
}

export async function getHelmReleaseManifest(
  name: string,
  namespace: string,
  revision?: number
): Promise<string> {
  return invoke<string>("get_helm_release_manifest", {
    name,
    namespace,
    revision,
  });
}

export async function uninstallHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("uninstall_helm_release", { name, namespace });
}
