import type { FluxKustomizationInfo } from "../../types";

import { invoke } from "./core";

// Flux commands
export async function listFluxKustomizations(
  namespace?: string
): Promise<FluxKustomizationInfo[]> {
  return invoke<FluxKustomizationInfo[]>("list_flux_kustomizations", { namespace });
}

export async function reconcileFluxKustomization(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("reconcile_flux_kustomization", { name, namespace });
}

export async function suspendFluxKustomization(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("suspend_flux_kustomization", { name, namespace });
}

export async function resumeFluxKustomization(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("resume_flux_kustomization", { name, namespace });
}

export async function reconcileFluxHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("reconcile_flux_helmrelease", { name, namespace });
}

export async function suspendFluxHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("suspend_flux_helmrelease", { name, namespace });
}

export async function resumeFluxHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("resume_flux_helmrelease", { name, namespace });
}
