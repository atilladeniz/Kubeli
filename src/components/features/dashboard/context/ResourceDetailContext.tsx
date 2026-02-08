"use client";

import { createContext, useContext } from "react";
import type { ResourceData } from "../../resources/ResourceDetail";

export type OpenResourceDetailResult =
  | "success"
  | "not_found"
  | "error"
  | "stale";

export interface ResourceDetailContextType {
  selectedResource: { data: ResourceData; type: string } | null;
  setSelectedResource: (resource: { data: ResourceData; type: string } | null) => void;
  openResourceDetail: (
    resourceType: string,
    name: string,
    namespace?: string
  ) => Promise<OpenResourceDetailResult>;
  handleDeleteFromContext: (resourceType: string, name: string, namespace?: string, onSuccess?: () => void) => void;
  handleUninstallFromContext: (name: string, namespace: string, onSuccess?: () => void) => void;
  handleScaleFromContext: (name: string, namespace: string, currentReplicas: number, onSuccess?: () => void) => void;
  closeResourceDetail: () => void;
}

export const ResourceDetailContext = createContext<ResourceDetailContextType | null>(null);

export function useResourceDetail() {
  const context = useContext(ResourceDetailContext);
  if (!context) throw new Error("useResourceDetail must be used within ResourceDetailProvider");
  return context;
}
