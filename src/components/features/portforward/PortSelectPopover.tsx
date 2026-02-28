"use client";

import { useState } from "react";
import { ArrowRightLeft, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ServicePortInfo, PortForwardInfo } from "@/lib/types";

interface PortSelectPopoverProps {
  ports: ServicePortInfo[];
  forwards: PortForwardInfo[];
  onForward: (port: ServicePortInfo) => void;
  onStop: (forwardId: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function getForwardForPort(
  forwards: PortForwardInfo[],
  port: ServicePortInfo
): PortForwardInfo | undefined {
  return forwards.find((f) => f.target_port === port.port);
}

export function PortSelectPopover({
  ports,
  forwards,
  onForward,
  onStop,
  children,
  disabled,
}: PortSelectPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[280px] p-0"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b">
          <p className="text-xs font-medium text-muted-foreground">
            Forward Port
          </p>
        </div>
        <div className="py-1">
          {ports.map((port) => {
            const forward = getForwardForPort(forwards, port);
            const isForwarded = !!forward;

            return (
              <div
                key={`${port.port}-${port.protocol}`}
                className="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-muted/50"
              >
                <span className="text-xs font-mono text-foreground">
                  {port.name && (
                    <span className="text-muted-foreground">
                      {port.name}:{" "}
                    </span>
                  )}
                  {port.port}
                  <span className="text-muted-foreground">
                    {" "}
                    &rarr; {port.target_port}/{port.protocol}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs",
                    isForwarded
                      ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      : "text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                  )}
                  onClick={() => {
                    if (isForwarded) {
                      onStop(forward.forward_id);
                    } else {
                      onForward(port);
                    }
                  }}
                >
                  {isForwarded ? (
                    <>
                      <Square className="size-3 mr-1" />
                      Stop
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="size-3 mr-1" />
                      Forward
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
