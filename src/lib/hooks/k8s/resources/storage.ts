"use client";

import {
  listPersistentVolumes,
  listPersistentVolumeClaims,
  listStorageClasses,
  listCSIDrivers,
  listCSINodes,
  listVolumeAttachments,
} from "../../../tauri/commands";
import type {
  PVInfo,
  PVCInfo,
  StorageClassInfo,
  CSIDriverInfo,
  CSINodeInfo,
  VolumeAttachmentInfo,
} from "../../../types";
import { createClusterScopedHook, createOptionalNamespaceHook } from "../factory";

/**
 * Hook for fetching PersistentVolumes (cluster-scoped).
 */
export const usePersistentVolumes = createClusterScopedHook<PVInfo>(
  "Persistent Volumes",
  listPersistentVolumes
);

/**
 * Hook for fetching PersistentVolumeClaims.
 */
export const usePersistentVolumeClaims = createOptionalNamespaceHook<PVCInfo>(
  "Persistent Volume Claims",
  listPersistentVolumeClaims
);

/**
 * Hook for fetching StorageClasses (cluster-scoped).
 */
export const useStorageClasses = createClusterScopedHook<StorageClassInfo>(
  "Storage Classes",
  listStorageClasses
);

/**
 * Hook for fetching CSIDrivers (cluster-scoped).
 */
export const useCSIDrivers = createClusterScopedHook<CSIDriverInfo>(
  "CSI Drivers",
  listCSIDrivers
);

/**
 * Hook for fetching CSINodes (cluster-scoped).
 */
export const useCSINodes = createClusterScopedHook<CSINodeInfo>("CSI Nodes", listCSINodes);

/**
 * Hook for fetching VolumeAttachments (cluster-scoped).
 */
export const useVolumeAttachments = createClusterScopedHook<VolumeAttachmentInfo>(
  "Volume Attachments",
  listVolumeAttachments
);
