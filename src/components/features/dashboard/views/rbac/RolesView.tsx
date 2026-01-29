"use client";

import { useRoles } from "@/lib/hooks/useK8sResources";
import { roleColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { RoleInfo } from "@/lib/types";

export const RolesView = createResourceView<RoleInfo>({
  hook: useRoles,
  columns: roleColumns,
  titleKey: "navigation.roles",
  emptyMessageKey: "empty.roles",
  resourceType: "role",
});
