"use client";

import { useLimitRanges } from "@/lib/hooks/useK8sResources";
import { limitRangeColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { LimitRangeInfo } from "@/lib/types";

export const LimitRangesView = createResourceView<LimitRangeInfo>({
  hook: useLimitRanges,
  columns: limitRangeColumns,
  titleKey: "navigation.limitRanges",
  emptyMessageKey: "empty.limitranges",
  resourceType: "limitrange",
});
