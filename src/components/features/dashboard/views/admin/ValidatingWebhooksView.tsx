"use client";

import { useValidatingWebhooks } from "@/lib/hooks/useK8sResources";
import { validatingWebhookColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { ValidatingWebhookInfo } from "@/lib/types";

export const ValidatingWebhooksView = createResourceView<ValidatingWebhookInfo>(
  {
    hook: useValidatingWebhooks,
    columns: validatingWebhookColumns,
    titleKey: "navigation.validatingWebhooks",
    emptyMessageKey: "empty.validatingwebhooks",
    resourceType: "validatingwebhookconfiguration",
    namespaced: false,
  },
);
