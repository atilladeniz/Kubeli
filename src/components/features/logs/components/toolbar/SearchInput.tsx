"use client";

import { useRef } from "react";
import { Search, Regex, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("common");
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative w-48 min-w-32 shrink">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        ref={searchInputRef}
        type="text"
        placeholder={useRegex ? "Regex..." : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-8 pl-9 pr-14 text-sm", regexError && useRegex && "border-destructive")}
      />
      {value.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-7 top-1/2 size-6 -translate-y-1/2 rounded"
          onClick={() => {
            onChange("");
            searchInputRef.current?.focus();
          }}
          aria-label={`${t("clear")} ${t("search")}`}
        >
          <X className="size-3.5" />
        </Button>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRegexToggle}
              className={cn(
                "absolute right-1 top-1/2 size-6 -translate-y-1/2 rounded",
                useRegex && "bg-primary/10 text-primary"
              )}
              aria-label={useRegex ? disableRegexTooltip : enableRegexTooltip}
            >
              <Regex className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{useRegex ? disableRegexTooltip : enableRegexTooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
