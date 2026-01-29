"use client";

import { useEndpointSlices } from "@/lib/hooks/useK8sResources";
import { endpointSliceColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { EndpointSliceInfo } from "@/lib/types";

export const EndpointSlicesView = createResourceView<EndpointSliceInfo>({
  hook: useEndpointSlices,
  columns: endpointSliceColumns,
  titleKey: "navigation.endpointSlices",
  emptyMessageKey: "empty.endpointslices",
  resourceType: "endpointslice",
  hideDelete: true, // EndpointSlices are managed by the system
});
