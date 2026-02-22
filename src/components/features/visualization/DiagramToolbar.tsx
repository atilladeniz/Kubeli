import { useRef } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DiagramToolbarProps {
  searchInput: string;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isCalculating: boolean;
  nodeCount: number;
  edgeCount: number;
}

export function DiagramToolbar({
  searchInput,
  onSearch,
  onRefresh,
  isLoading,
  isCalculating,
  nodeCount,
  edgeCount,
}: DiagramToolbarProps) {
  const t = useTranslations("diagram");
  const tCommon = useTranslations("common");
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2 p-2 border-b">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder={t("searchResources")}
          value={searchInput}
          onChange={(e) => onSearch(e.target.value)}
          className="h-9 pl-9 pr-8"
        />
        {searchInput.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-1 top-1/2 size-6 -translate-y-1/2 rounded"
            onClick={() => {
              onSearch("");
              searchInputRef.current?.focus();
            }}
            aria-label={`${tCommon("clear")} ${tCommon("search")}`}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading || isCalculating}
      >
        <RefreshCw
          className={cn(
            "size-4",
            (isLoading || isCalculating) && "animate-spin"
          )}
        />
      </Button>

      <div className="flex items-center gap-1 ml-auto">
        <Badge variant="secondary" className="text-xs">
          {t("nodes", { count: nodeCount })}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {t("edges", { count: edgeCount })}
        </Badge>
      </div>
    </div>
  );
}
