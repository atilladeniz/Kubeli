"use client";

import { Search, Regex } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  useRegex: boolean;
  onRegexToggle: () => void;
  regexError: string | null;
  placeholder: string;
  enableRegexTooltip: string;
  disableRegexTooltip: string;
}

export function SearchInput({
  value,
  onChange,
  useRegex,
  onRegexToggle,
  regexError,
  placeholder,
  enableRegexTooltip,
  disableRegexTooltip,
}: SearchInputProps) {
  return (
    <div className="relative w-48 shrink-0">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder={useRegex ? "Regex..." : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-8 pl-9 pr-8 text-sm", regexError && useRegex && "border-destructive")}
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRegexToggle}
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 size-6 rounded flex items-center justify-center hover:bg-accent transition-colors",
                useRegex && "bg-primary/10 text-primary"
              )}
            >
              <Regex className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{useRegex ? disableRegexTooltip : enableRegexTooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
