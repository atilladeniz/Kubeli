"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SortableTabProps } from "../types";

export function SortableTab({
  tab,
  isActive,
  canClose,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToRight,
  isLast,
  onMiddleClick,
  title,
  labels,
}: SortableTabProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleX: 1, scaleY: 1 } : null
    ),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          data-tab-id={tab.id}
          {...attributes}
          {...listeners}
          onClick={onActivate}
          onMouseDown={onMiddleClick}
          className={cn(
            "group flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md shrink-0 max-w-[200px] border transition-colors select-none",
            isActive
              ? "bg-muted border-border text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            isDragging && "shadow-lg cursor-grabbing"
          )}
        >
          <Tooltip open={isTruncated ? undefined : false}>
            <TooltipTrigger asChild>
              <span
                ref={textRef}
                className="truncate"
                onPointerEnter={() => {
                  const element = textRef.current;
                  setIsTruncated(!!element && element.scrollWidth > element.clientWidth);
                }}
              >
                {title}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{title}</TooltipContent>
          </Tooltip>
          {canClose && (
            <span
              role="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              className="shrink-0 rounded p-0.5 hover:bg-background/50 opacity-50 hover:opacity-100"
            >
              <X className="size-3" />
            </span>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onClose} disabled={!canClose}>
          {labels.close}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers} disabled={!canClose}>
          {labels.closeOthers}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseToRight} disabled={isLast}>
          {labels.closeToRight}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
