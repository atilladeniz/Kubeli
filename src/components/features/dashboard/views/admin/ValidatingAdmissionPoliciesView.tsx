"use client";

import { useValidatingAdmissionPolicies } from "@/lib/hooks/useK8sResources";
import { validatingAdmissionPolicyColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { ValidatingAdmissionPolicyInfo } from "@/lib/types";

export const ValidatingAdmissionPoliciesView =
  createResourceView<ValidatingAdmissionPolicyInfo>({
    hook: useValidatingAdmissionPolicies,
    columns: validatingAdmissionPolicyColumns,
    titleKey: "navigation.admissionPolicies",
    emptyMessageKey: "empty.admissionpolicies",
    resourceType: "validatingadmissionpolicy",
    namespaced: false,
  });
