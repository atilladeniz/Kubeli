"use client";

import { useTranslations } from "next-intl";
import { Check, ChevronRight, ChevronsUpDown } from "lucide-react";
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
import type { NamespaceSectionProps } from "./types";

export function NamespaceSection({
  isConnected,
  namespaces,
  currentNamespace,
  namespaceOpen,
  isNamespaceSectionOpen,
  setNamespaceOpen,
  setIsNamespaceSectionOpen,
  setCurrentNamespace,
}: NamespaceSectionProps) {
  const t = useTranslations();
  const tCluster = useTranslations("cluster");

  if (!isConnected || namespaces.length === 0) {
    return null;
  }

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
                isNamespaceSectionOpen && "mb-2"
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
                    <span className="truncate">
                      {currentNamespace || tCluster("allNamespaces")}
                    </span>
                  </Badge>
                )}
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    isNamespaceSectionOpen && "rotate-90"
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
                  {currentNamespace ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          getNamespaceColor(currentNamespace).dot
                        )}
                      />
                      <span className="truncate">{currentNamespace}</span>
                    </span>
                  ) : (
                    tCluster("allNamespaces")
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
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
                        onSelect={(value) => {
                          setCurrentNamespace(value === "all" ? "" : value);
                          setNamespaceOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            currentNamespace ? "opacity-0" : "opacity-100"
                          )}
                        />
                        {tCluster("allNamespaces")}
                      </CommandItem>
                      {namespaces.map((ns) => {
                        const color = getNamespaceColor(ns);
                        return (
                          <CommandItem
                            key={ns}
                            value={ns}
                            onSelect={(value) => {
                              setCurrentNamespace(value);
                              setNamespaceOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                currentNamespace === ns ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "size-2 rounded-full shrink-0",
                                  color.dot
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
