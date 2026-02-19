"use client";

import { useTranslations } from "next-intl";
import { Check, ChevronRight, ChevronsUpDown, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getNamespaceColor } from "@/lib/utils/colors";
import type { NamespaceSectionProps } from "../types/types";

export function NamespaceSection({
  isConnected,
  namespaces,
  selectedNamespaces,
  namespaceOpen,
  isNamespaceSectionOpen,
  setNamespaceOpen,
  setIsNamespaceSectionOpen,
  toggleNamespace,
  selectAllNamespaces,
}: NamespaceSectionProps) {
  const t = useTranslations();
  const tCluster = useTranslations("cluster");

  if (!isConnected || namespaces.length === 0) {
    return null;
  }

  const isAllSelected = selectedNamespaces.length === 0;
  const isSingleSelected = selectedNamespaces.length === 1;
  const isMultiSelected = selectedNamespaces.length > 1;

  // Trigger button label
  const triggerLabel = isAllSelected
    ? tCluster("allNamespaces")
    : isSingleSelected
      ? selectedNamespaces[0]
      : `${selectedNamespaces.length} namespaces`;

  // Collapsed badge label
  const badgeLabel = isAllSelected
    ? tCluster("allNamespaces")
    : isSingleSelected
      ? selectedNamespaces[0]
      : `${selectedNamespaces.length} namespaces`;

  return (
    <>
      <div className="p-3 overflow-hidden">
        <Collapsible
          open={isNamespaceSectionOpen}
          onOpenChange={setIsNamespaceSectionOpen}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                isNamespaceSectionOpen && "mb-2",
              )}
              aria-label={t("common.toggleSection", {
                section: tCluster("namespace"),
              })}
            >
              <span>{tCluster("namespace")}</span>
              <span className="flex items-center gap-2">
                {!isNamespaceSectionOpen && (
                  <Badge
                    variant="secondary"
                    className="max-w-[130px] px-2 py-0 text-[10px]"
                  >
                    <span className="truncate">{badgeLabel}</span>
                  </Badge>
                )}
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    isNamespaceSectionOpen && "rotate-90",
                  )}
                />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1">
            <Popover open={namespaceOpen} onOpenChange={setNamespaceOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={namespaceOpen}
                  className="w-full justify-between"
                >
                  {isSingleSelected ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          getNamespaceColor(selectedNamespaces[0]).dot,
                        )}
                      />
                      <span className="truncate">{selectedNamespaces[0]}</span>
                    </span>
                  ) : isMultiSelected ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="flex items-center gap-0.5 shrink-0">
                        {selectedNamespaces.slice(0, 3).map((ns) => (
                          <span
                            key={ns}
                            className={cn(
                              "size-2 rounded-full",
                              getNamespaceColor(ns).dot,
                            )}
                          />
                        ))}
                      </span>
                      <span className="truncate">{triggerLabel}</span>
                    </span>
                  ) : (
                    tCluster("allNamespaces")
                  )}
                  {!isAllSelected ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Clear selection"
                      className="ml-2 shrink-0 rounded-sm p-0.5 opacity-50 hover:opacity-100 hover:bg-muted transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAllNamespaces();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          selectAllNamespaces();
                        }
                      }}
                    >
                      <X className="size-3.5" />
                    </span>
                  ) : (
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="min-w-(--radix-popover-trigger-width) p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder={`${t("common.search")}...`} />
                  <CommandList>
                    <CommandEmpty>{t("common.noData")}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          selectAllNamespaces();
                        }}
                      >
                        {isAllSelected ? (
                          <Check className="mr-2 size-4 opacity-100" />
                        ) : isMultiSelected ? (
                          <Minus className="mr-2 size-4 opacity-60" />
                        ) : (
                          <Check className="mr-2 size-4 opacity-0" />
                        )}
                        {tCluster("allNamespaces")}
                      </CommandItem>
                      {namespaces.map((ns) => {
                        const color = getNamespaceColor(ns);
                        const isSelected = selectedNamespaces.includes(ns);
                        return (
                          <CommandItem
                            key={ns}
                            value={ns}
                            onSelect={() => {
                              toggleNamespace(ns);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                isSelected ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "size-2 rounded-full shrink-0",
                                  color.dot,
                                )}
                              />
                              <span>{ns}</span>
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Separator />
    </>
  );
}
