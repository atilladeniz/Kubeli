import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TitlebarIconButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut: string;
  onClick: () => void;
}

export function TitlebarIconButton({ icon: Icon, label, shortcut, onClick }: TitlebarIconButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClick}
          >
            <Icon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-2">
          <span>{label}</span>
          <Kbd className="text-[10px]">{shortcut}</Kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
