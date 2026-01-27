"use client";

import { useSecrets } from "@/lib/hooks/useK8sResources";
import { secretColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { SecretInfo } from "@/lib/types";

export const SecretsView = createResourceView<SecretInfo>({
  hook: useSecrets,
  columns: secretColumns,
  titleKey: "navigation.secrets",
  emptyMessageKey: "empty.secrets",
  resourceType: "secret",
});
