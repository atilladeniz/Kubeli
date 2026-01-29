"use client";

import { useRoleBindings } from "@/lib/hooks/useK8sResources";
import { roleBindingColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { RoleBindingInfo } from "@/lib/types";

export const RoleBindingsView = createResourceView<RoleBindingInfo>({
  hook: useRoleBindings,
  columns: roleBindingColumns,
  titleKey: "navigation.roleBindings",
  emptyMessageKey: "empty.rolebindings",
  resourceType: "rolebinding",
});
