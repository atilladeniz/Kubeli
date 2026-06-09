"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TruncateTooltipProps extends React.ComponentProps<"span"> {
  content: string;
  tooltipContent?: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  delayDuration?: number;
}

export function TruncateTooltip({
  content,
  tooltipContent,
  className,
  side = "right",
  delayDuration = 500,
  onPointerEnter,
  onFocus,
  ...props
}: TruncateTooltipProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const updateTruncation = useCallback(() => {
    const element = textRef.current;
    setIsTruncated(!!element && element.scrollWidth > element.clientWidth);
  }, []);

  useEffect(() => {
    const element = textRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateTruncation();
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [content, updateTruncation]);

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip open={isTruncated ? undefined : false}>
        <TooltipTrigger asChild>
        <span
          ref={textRef}
          className={cn("text-left", className)}
          onPointerEnter={(event) => {
            updateTruncation();
            onPointerEnter?.(event);
            }}
            onFocus={(event) => {
              updateTruncation();
              onFocus?.(event);
            }}
            {...props}
          >
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side}>
          {tooltipContent ?? content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
