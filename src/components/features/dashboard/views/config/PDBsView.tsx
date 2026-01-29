"use client";

import { usePDBs } from "@/lib/hooks/useK8sResources";
import { pdbColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { PDBInfo } from "@/lib/types";

export const PDBsView = createResourceView<PDBInfo>({
  hook: usePDBs,
  columns: pdbColumns,
  titleKey: "navigation.podDisruptionBudgets",
  emptyMessageKey: "empty.pdbs",
  resourceType: "pdb",
});
