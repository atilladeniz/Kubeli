"use client";

// Composer toolbar under the chat input: provider + model, reasoning effort,
// the read-only badge and a context estimate. Models and effort levels come
// from the installed CLI; the choice is passed to it with every message.

import { Brain, Check, ChevronDown, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore, type AiCliProvider } from "@/lib/stores/ui-store";
import type { AiModelChoice } from "@/lib/tauri/commands/ai";
import { useModelCatalog } from "../hooks/useModelCatalog";

const PROVIDERS: { id: AiCliProvider; label: string; dot: string }[] = [
  { id: "claude", label: "Claude", dot: "bg-orange-500" },
  { id: "codex", label: "Codex", dot: "bg-emerald-500" },
  { id: "opencode", label: "OpenCode", dot: "bg-sky-500" },
  { id: "droid", label: "Droid", dot: "bg-violet-500" },
];

const KNOWN_EFFORTS = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
]);

/** App-styled tooltip around a trigger, opened on hover only: closing a menu
 *  hands focus back to its trigger, and a focus-opened tooltip would pop up
 *  again right after the menu closed. */
function Hint({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild onFocus={(e) => e.preventDefault()}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

function Ring({ share }: { share: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 -rotate-90" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth="2"
      />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(share, 100) / 100)}
      />
    </svg>
  );
}

const pill =
  "text-muted-foreground hover:text-foreground hover:bg-foreground/5 data-[state=open]:bg-foreground/5 data-[state=open]:text-foreground h-7 cursor-pointer gap-1.5 rounded-lg px-2 text-xs font-medium [&_*]:cursor-pointer";

interface ComposerToolbarProps {
  /** Characters in the conversation so far, used for a token estimate. */
  contextChars: number;
  disabled: boolean;
  /** Provider of the running session; switching applies to the next one. */
  sessionProvider: AiCliProvider | null;
}

export function ComposerToolbar({
  contextChars,
  disabled,
  sessionProvider,
}: ComposerToolbarProps) {
  const t = useTranslations("ai.composer");
  const settingsProvider =
    useUIStore((s) => s.settings.aiCliProvider) || "claude";
  const choices = useUIStore((s) => s.settings.aiModelChoice) ?? {};
  const updateSettings = useUIStore((s) => s.updateSettings);

  // Model/effort belong to the provider that will receive the next message.
  const provider = sessionProvider ?? settingsProvider;
  const catalog = useModelCatalog(provider);
  const choice: AiModelChoice = choices[provider] ?? {};
  const setChoice = (next: AiModelChoice) =>
    updateSettings({ aiModelChoice: { ...choices, [provider]: next } });

  const models = catalog?.models ?? [];
  const selected = models.find((m) => m.id === choice.model);
  const defaultModel = models.find((m) => m.id === catalog?.defaultModel);
  const effective = selected ?? defaultModel;
  const efforts = effective?.efforts ?? [];
  const effortDefault = selected
    ? selected.defaultEffort
    : (catalog?.defaultEffort ?? effective?.defaultEffort);
  const effort =
    choice.effort && efforts.some((e) => e.id === choice.effort)
      ? choice.effort
      : null;

  const effortLabel = (id: string) =>
    KNOWN_EFFORTS.has(id) ? t(`efforts.${id}.label`) : id;
  const effortDetail = (id: string, fallback: string | null) =>
    KNOWN_EFFORTS.has(id) ? t(`efforts.${id}.detail`) : (fallback ?? "");

  const providerInfo = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const modelLabel = selected?.label ?? t("default");
  const currentEffortLabel = effort ? effortLabel(effort) : t("default");

  // ponytail: ~4 chars per token; switch to the CLIs' usage events once the
  // backend forwards them.
  const usedTokens = Math.round(contextChars / 4);
  const window = effective?.contextWindow ?? null;
  const share = window ? Math.round((usedTokens / window) * 100) : null;
  const contextHint = window
    ? t("contextHint", {
        used: formatTokens(usedTokens),
        total: formatTokens(window),
      })
    : t("contextTokens", { used: formatTokens(usedTokens) });

  const defaultModelText = catalog?.defaultModel
    ? t("cliSettingValue", {
        value: [
          defaultModel?.label ?? catalog.defaultModel,
          catalog.defaultEffort ? effortLabel(catalog.defaultEffort) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })
    : t("cliSetting");

  return (
    <div className="@container w-full min-w-0">
      <div className="flex w-full min-w-0 items-center gap-0.5">
        <DropdownMenu>
          <Hint
            label={t("assistantAndModel", {
              provider: providerInfo.label,
              model: modelLabel,
            })}
          >
            <DropdownMenuTrigger asChild disabled={disabled}>
              <Button variant="ghost" className={cn(pill, "min-w-0")}>
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    providerInfo.dot,
                  )}
                />
                <span className="hidden @3xs:inline">{providerInfo.label}</span>
                <span className="text-muted-foreground/50 hidden @xs:inline">
                  ·
                </span>
                <span className="hidden truncate @xs:inline">{modelLabel}</span>
                <ChevronDown className="size-3 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent
            align="start"
            className="max-h-[min(70vh,520px)] w-72 overflow-y-auto"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {t("assistant")}
            </DropdownMenuLabel>
            {PROVIDERS.map((p) => (
              <DropdownMenuItem
                key={p.id}
                className="cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  updateSettings({ aiCliProvider: p.id });
                }}
              >
                <span className={cn("size-2 rounded-full", p.dot)} />
                <span className="flex-1">{p.label}</span>
                {p.id === settingsProvider && <Check className="size-3.5" />}
              </DropdownMenuItem>
            ))}
            {sessionProvider && sessionProvider !== settingsProvider && (
              <p className="text-muted-foreground px-2 pb-1 text-[11px]">
                {t("switchNextSession", { provider: providerInfo.label })}
              </p>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {sessionProvider
                ? t("modelFor", { provider: providerInfo.label })
                : t("model")}
            </DropdownMenuLabel>
            <DropdownMenuItem
              className="cursor-pointer items-start"
              onSelect={(e) => {
                e.preventDefault();
                setChoice({});
              }}
            >
              <div className="flex flex-1 flex-col">
                <span>{t("default")}</span>
                <span className="text-muted-foreground text-[11px]">
                  {defaultModelText}
                </span>
              </div>
              {!choice.model && <Check className="mt-0.5 size-3.5" />}
            </DropdownMenuItem>
            {catalog === null && (
              <p className="text-muted-foreground px-2 py-1.5 text-xs">
                {t("loadingModels")}
              </p>
            )}
            {catalog !== null && models.length === 0 && (
              <p className="text-muted-foreground px-2 py-1.5 text-[11px]">
                {t("noModelList", { provider: providerInfo.label })}
              </p>
            )}
            {models.map((m) => (
              <DropdownMenuItem
                key={m.id}
                className="cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  setChoice({ model: m.id, effort: choice.effort });
                }}
              >
                <span className="flex-1 truncate">{m.label}</span>
                {m.contextWindow && (
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {formatTokens(m.contextWindow)}
                  </span>
                )}
                {choice.model === m.id && <Check className="size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Shown while the catalog loads so the toolbar doesn't shift; hidden
            only once we know the model has no effort levels. */}
        {(catalog === null || efforts.length > 0) && (
          <DropdownMenu>
            <Hint label={t("effortHint", { value: currentEffortLabel })}>
              <DropdownMenuTrigger
                asChild
                disabled={disabled || catalog === null}
              >
                <Button variant="ghost" className={cn(pill, "shrink-0")}>
                  <Brain className="size-3.5" />
                  <span className="hidden @md:inline">
                    {currentEffortLabel}
                  </span>
                </Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {t("effort")}
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="cursor-pointer items-start"
                onSelect={() => setChoice({ model: choice.model })}
              >
                <div className="flex flex-1 flex-col">
                  <span>{t("default")}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {effortDefault
                      ? t("modelDefault", { value: effortLabel(effortDefault) })
                      : t("cliDefault")}
                  </span>
                </div>
                {!effort && <Check className="mt-0.5 size-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {efforts.map((e) => (
                <DropdownMenuItem
                  key={e.id}
                  className="cursor-pointer items-start"
                  onSelect={() =>
                    setChoice({ model: choice.model, effort: e.id })
                  }
                >
                  <div className="flex flex-1 flex-col">
                    <span>{effortLabel(e.id)}</span>
                    {effortDetail(e.id, e.description) && (
                      <span className="text-muted-foreground text-[11px]">
                        {effortDetail(e.id, e.description)}
                      </span>
                    )}
                  </div>
                  {effort === e.id && <Check className="mt-0.5 size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Kubeli only runs read-only kubectl: an info badge, not a menu of
            modes nobody can pick. Help cursor (layered !important beats the
            global [data-state] pointer rule) since it isn't clickable. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              aria-label={t("readOnly")}
              className="text-muted-foreground inline-flex h-7 cursor-help! items-center gap-1.5 rounded-lg px-2 text-xs font-medium [&_*]:cursor-help!"
            >
              <Eye className="size-3.5" />
              <span className="hidden @md:inline">{t("readOnly")}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-60">
            {t("readOnlyHint")}
          </TooltipContent>
        </Tooltip>

        <Popover>
          <Hint label={contextHint}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  pill,
                  "ml-auto shrink-0 rounded-full tabular-nums",
                )}
              >
                <Ring share={share ?? 0} />
                <span>
                  {share !== null ? `${share}%` : formatTokens(usedTokens)}
                </span>
              </Button>
            </PopoverTrigger>
          </Hint>
          <PopoverContent align="end" className="w-64 space-y-2.5 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("context")}</span>
              <span className="tabular-nums">
                ≈ {formatTokens(usedTokens)}
                {window ? ` / ${formatTokens(window)}` : ""}
              </span>
            </div>
            {share !== null && (
              <div className="bg-foreground/10 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.min(share, 100)}%` }}
                />
              </div>
            )}
            <p className="text-muted-foreground leading-relaxed">
              {t("contextNote", { provider: providerInfo.label })}
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
