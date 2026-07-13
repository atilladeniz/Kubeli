import type { HelmReleaseInfo } from "../../types";

import { invoke } from "./core";

// Helm commands
export async function listHelmReleases(namespace?: string): Promise<HelmReleaseInfo[]> {
  return invoke<HelmReleaseInfo[]>("list_helm_releases", { namespace });
}

export async function uninstallHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("uninstall_helm_release", { name, namespace });
}
