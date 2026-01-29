"use client";

import { useMutatingWebhooks } from "@/lib/hooks/useK8sResources";
import { mutatingWebhookColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { MutatingWebhookInfo } from "@/lib/types";

export const MutatingWebhooksView = createResourceView<MutatingWebhookInfo>({
  hook: useMutatingWebhooks,
  columns: mutatingWebhookColumns,
  titleKey: "navigation.mutatingWebhooks",
  emptyMessageKey: "empty.mutatingwebhooks",
  resourceType: "mutatingwebhookconfiguration",
  namespaced: false,
});
