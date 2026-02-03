"use client";

import {
  listConfigmaps,
  listSecrets,
  listHPAs,
  listLimitRanges,
  listResourceQuotas,
  listPDBs,
} from "../../../tauri/commands";
import type {
  ConfigMapInfo,
  SecretInfo,
  HPAInfo,
  LimitRangeInfo,
  ResourceQuotaInfo,
  PDBInfo,
} from "../../../types";
import { createListOptionsHook } from "../factory";

/**
 * Hook for fetching ConfigMaps.
 */
export const useConfigMaps = createListOptionsHook<ConfigMapInfo>(
  "ConfigMaps",
  listConfigmaps
);

/**
 * Hook for fetching Secrets.
 */
export const useSecrets = createListOptionsHook<SecretInfo>("Secrets", listSecrets);

/**
 * Hook for fetching HorizontalPodAutoscalers.
 */
export const useHPAs = createListOptionsHook<HPAInfo>("HPAs", listHPAs);

/**
 * Hook for fetching LimitRanges.
 */
export const useLimitRanges = createListOptionsHook<LimitRangeInfo>(
  "LimitRanges",
  listLimitRanges
);

/**
 * Hook for fetching ResourceQuotas.
 */
export const useResourceQuotas = createListOptionsHook<ResourceQuotaInfo>(
  "ResourceQuotas",
  listResourceQuotas
);

/**
 * Hook for fetching PodDisruptionBudgets.
 */
export const usePDBs = createListOptionsHook<PDBInfo>("PDBs", listPDBs);
