import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AIToggleButtonProps {
  isOpen?: boolean;
  isProcessing?: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
}

export function AIToggleButton({ isOpen, isProcessing, isDisabled, onToggle }: AIToggleButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isOpen ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "size-6",
              isOpen && "bg-primary/10 text-primary hover:bg-primary/20",
              !isOpen && isProcessing && "text-violet-500",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={isDisabled ? undefined : onToggle}
            disabled={isDisabled}
          >
            {!isOpen && isProcessing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-2">
          {isDisabled ? (
            <span className="text-muted-foreground">AI CLI not installed</span>
          ) : (
            <>
              <span>AI Assistant</span>
              <Kbd className="text-[10px]">G I</Kbd>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
