"use client";

import { useVolumeAttachments } from "@/lib/hooks/useK8sResources";
import { volumeAttachmentColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { VolumeAttachmentInfo } from "@/lib/types";

export const VolumeAttachmentsView = createResourceView<VolumeAttachmentInfo>({
  hook: useVolumeAttachments,
  columns: volumeAttachmentColumns,
  titleKey: "navigation.volumeAttachments",
  emptyMessageKey: "empty.volumeattachments",
  resourceType: "volumeattachment",
  namespaced: false,
});
