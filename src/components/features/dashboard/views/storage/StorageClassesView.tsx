"use client";

import { useStorageClasses } from "@/lib/hooks/useK8sResources";
import { storageClassColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { StorageClassInfo } from "@/lib/types";

export const StorageClassesView = createResourceView<StorageClassInfo>({
  hook: useStorageClasses,
  columns: storageClassColumns,
  titleKey: "navigation.storageClasses",
  emptyMessageKey: "empty.storageclasses",
  resourceType: "storageclass",
  namespaced: false,
});
