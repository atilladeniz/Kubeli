"use client";

import { useTranslations } from "next-intl";
import {
  ArrowRightLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ReconnectingTimer } from "../components/ReconnectingTimer";
import type { PortForwardsSectionProps } from "../types/types";

export function PortForwardsSection({
  isConnected,
  forwards,
  isPortForwardsSectionOpen,
  setIsPortForwardsSectionOpen,
  onResourceSelect,
  onOpenForwardInBrowser,
  stopForward,
}: PortForwardsSectionProps) {
  const t = useTranslations();
  const tNav = useTranslations("navigation");

  if (!isConnected || forwards.length === 0) {
    return null;
  }

  return (
    <>
      <div className="p-3 overflow-hidden">
        <Collapsible
          open={isPortForwardsSectionOpen}
          onOpenChange={setIsPortForwardsSectionOpen}
        >
          <div
            className={cn(
              "flex items-center justify-between",
              isPortForwardsSectionOpen && "mb-2",
            )}
          >
            <button
              onClick={() => onResourceSelect("port-forwards")}
              className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <ArrowRightLeft className="size-3" />
              {tNav("portForwards")}
              <Maximize2 className="size-2.5" />
            </button>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {forwards.length}
              </Badge>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-5 p-0 text-muted-foreground hover:text-foreground"
                  aria-label={t("common.toggleSection", {
                    section: tNav("portForwards"),
                  })}
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 transition-transform",
                      isPortForwardsSectionOpen && "rotate-90",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent
            className={cn(
              "space-y-1",
              forwards.length > 3 && "max-h-[132px] overflow-y-auto pr-1",
            )}
          >
            {forwards.map((forward) => (
              <div
                key={forward.forward_id}
                className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs group overflow-hidden"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      forward.status === "reconnecting"
                        ? "self-start mt-[5px]"
                        : "self-center",
                      forward.status === "connected"
                        ? "bg-green-400"
                        : forward.status === "connecting"
                          ? "bg-yellow-400 animate-pulse"
                          : forward.status === "reconnecting"
                            ? "bg-orange-400 animate-pulse"
                            : "bg-red-400",
                    )}
                  />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-medium max-w-[80px]">
                        {forward.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        :{forward.local_port}
                      </span>
                    </div>
                    {forward.status === "reconnecting" && (
                      <ReconnectingTimer forwardId={forward.forward_id} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 p-0 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onOpenForwardInBrowser(forward.local_port);
                    }}
                    aria-label={`Open localhost:${forward.local_port}`}
                  >
                    <ExternalLink className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 p-0 rounded hover:bg-background text-muted-foreground hover:text-destructive"
                    onClick={() => void stopForward(forward.forward_id)}
                    aria-label={`Stop ${forward.name} port forward`}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Separator />
    </>
  );
}
