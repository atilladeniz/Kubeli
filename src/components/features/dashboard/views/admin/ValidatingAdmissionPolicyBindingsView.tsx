"use client";

import { useValidatingAdmissionPolicyBindings } from "@/lib/hooks/useK8sResources";
import { validatingAdmissionPolicyBindingColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { ValidatingAdmissionPolicyBindingInfo } from "@/lib/types";

export const ValidatingAdmissionPolicyBindingsView =
  createResourceView<ValidatingAdmissionPolicyBindingInfo>({
    hook: useValidatingAdmissionPolicyBindings,
    columns: validatingAdmissionPolicyBindingColumns,
    titleKey: "navigation.admissionPolicyBindings",
    emptyMessageKey: "empty.admissionpolicybindings",
    resourceType: "validatingadmissionpolicybinding",
    namespaced: false,
  });
