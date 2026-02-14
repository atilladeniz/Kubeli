import type { Tab } from "@/lib/stores/tabs-store";
import type { MouseEvent } from "react";

export interface PendingCloseState {
  tabIds: string[];
}

export interface SortableTabLabels {
  close: string;
  closeOthers: string;
  closeToRight: string;
}

export interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  canClose: boolean;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  isLast: boolean;
  onMiddleClick: (e: MouseEvent) => void;
  title: string;
  labels: SortableTabLabels;
}
