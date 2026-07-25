import type { FluxKustomizationInfo } from "../../types";

import { invoke } from "./core";

// Flux commands
export async function listFluxKustomizations(
  namespace?: string
): Promise<FluxKustomizationInfo[]> {
  return invoke<FluxKustomizationInfo[]>("list_flux_kustomizations", { namespace });
}

// Reconcile commands return the request token; pass it to waitFluxReconcile
// to follow up with the actual outcome.
export async function reconcileFluxKustomization(
  name: string,
  namespace: string
): Promise<string> {
  return invoke<string>("reconcile_flux_kustomization", { name, namespace });
}

export async function reconcileFluxKustomizationWithSource(
  name: string,
  namespace: string
): Promise<string> {
  return invoke<string>("reconcile_flux_kustomization_with_source", { name, namespace });
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
): Promise<string> {
  return invoke<string>("reconcile_flux_helmrelease", { name, namespace });
}

export async function reconcileFluxHelmReleaseWithSource(
  name: string,
  namespace: string
): Promise<string> {
  return invoke<string>("reconcile_flux_helmrelease_with_source", { name, namespace });
}

export async function forceFluxHelmRelease(
  name: string,
  namespace: string
): Promise<string> {
  return invoke<string>("force_flux_helmrelease", { name, namespace });
}

export async function resetFluxHelmRelease(
  name: string,
  namespace: string
): Promise<string> {
  return invoke<string>("reset_flux_helmrelease", { name, namespace });
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

export interface FluxReconcileResult {
  outcome: "succeeded" | "failed" | "pending";
  message: string | null;
}

export async function waitFluxReconcile(
  kind: "kustomization" | "helmrelease",
  name: string,
  namespace: string,
  token: string
): Promise<FluxReconcileResult> {
  return invoke<FluxReconcileResult>("wait_flux_reconcile", {
    kind,
    name,
    namespace,
    token,
  });
}
