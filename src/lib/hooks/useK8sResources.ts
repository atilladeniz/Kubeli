"use client";

/**
 * Kubernetes Resource Hooks - Backwards Compatibility Layer
 *
 * This file re-exports all hooks from the new modular structure at @/lib/hooks/k8s.
 * All existing imports will continue to work without changes.
 *
 * The new modular structure provides:
 * - ~85% reduction in code (1897 lines → ~300 lines)
 * - Factory pattern for consistent hook creation
 * - Better separation of concerns by resource category
 * - Easier testing and maintenance
 *
 * @see src/lib/hooks/k8s/index.ts for the new module structure
 */

// Re-export everything from the new modular structure
export * from "./k8s";

// Re-export types for backwards compatibility
export type { UseK8sResourcesOptions, UseK8sResourcesReturn } from "./k8s/types";
