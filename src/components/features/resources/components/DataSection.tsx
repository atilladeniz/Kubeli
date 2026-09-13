"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy, Check, Eye, EyeOff, Key, ShieldCheck, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  parseSecretFromYaml,
  parseConfigMapFromYaml,
  decodeBase64,
} from "../lib/utils";
import { TlsCertificateView } from "./TlsCertificateView";

/** Secrets of this type carry an X.509 certificate in tls.crt */
const TLS_SECRET_TYPE = "kubernetes.io/tls";
/** Above this many keys the list is windowed instead of rendered in full */
export const VIRTUALIZE_THRESHOLD = 50;
/** Estimated row height: label line plus a one-line value box */
const ROW_ESTIMATE = 72;
/** Revealed secret values hide themselves again after this long */
const REVEAL_TIMEOUT_MS = 10000;

export type DataKind = "secret" | "configmap";

interface DataEntry {
  key: string;
  value: string;
  /** From a ConfigMap's binaryData: base64, not meant to be read */
  binary: boolean;
}

interface DataSectionProps {
  yaml: string;
  kind: DataKind;
}

/**
 * Data view for Secrets and ConfigMaps.
 *
 * Secrets keep the blur-until-revealed behaviour, ConfigMaps show their
 * values as plain text. Both get search by key, per-key copy, and a
 * virtualized list once the key count grows past VIRTUALIZE_THRESHOLD.
 */
export function DataSection({ yaml, kind }: DataSectionProps) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [wrap, setWrap] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const revealTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Parsing the YAML on every render was the original lag: hundreds of keys
  // re-parsed on each reveal or copy click.
  const parsed = useMemo(
    () =>
      kind === "secret"
        ? parseSecretFromYaml(yaml)
        : parseConfigMapFromYaml(yaml),
    [yaml, kind]
  );

  const entries = useMemo<DataEntry[]>(() => {
    if (!parsed) return [];
    const plain = Object.entries(parsed.data).map(([key, value]) => ({
      key,
      value,
      binary: false,
    }));
    const binary =
      "binaryData" in parsed
        ? Object.entries(parsed.binaryData).map(([key, value]) => ({
            key,
            value,
            binary: true,
          }))
        : [];
    return [...plain, ...binary];
  }, [parsed]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((e) => e.key.toLowerCase().includes(needle));
  }, [entries, query]);

  if (!parsed || entries.length === 0) {
    return null;
  }

  const secretType = "type" in parsed ? parsed.type : null;
  const isTlsSecret = secretType === TLS_SECRET_TYPE;
  const certificatePem =
    isTlsSecret && parsed.data["tls.crt"]
      ? decodeBase64(parsed.data["tls.crt"])
      : null;

  const hideKey = (key: string) => {
    setRevealedKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const toggleReveal = (key: string) => {
    const timeouts = revealTimeouts.current;
    const existing = timeouts.get(key);
    if (existing) {
      clearTimeout(existing);
      timeouts.delete(key);
    }
    if (revealedKeys.has(key)) {
      hideKey(key);
      return;
    }
    setRevealedKeys((current) => new Set(current).add(key));
    timeouts.set(
      key,
      setTimeout(() => {
        timeouts.delete(key);
        hideKey(key);
      }, REVEAL_TIMEOUT_MS)
    );
  };

  const copyValue = async (entry: DataEntry) => {
    const text =
      kind === "secret" && !entry.binary ? decodeBase64(entry.value) : entry.value;
    await navigator.clipboard.writeText(text);
    setCopiedKey(entry.key);
    toast.success(t("messages.copySuccess"));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const renderRow = (entry: DataEntry) => (
    <DataRow
      entry={entry}
      kind={kind}
      wrap={wrap}
      revealed={revealedKeys.has(entry.key)}
      copied={copiedKey === entry.key}
      onToggleReveal={() => toggleReveal(entry.key)}
      onCopy={() => copyValue(entry)}
      binaryLabel={t("configuration.binary")}
    />
  );

  return (
    <>
      {secretType && (
        <section>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
            {t("configuration.type")}
          </h3>
          <p className="text-base font-medium">{secretType}</p>
        </section>
      )}

      {/* Certificate details for TLS secrets: the raw tls.crt blob below is
          unreadable, so the parsed view goes first. */}
      {certificatePem && (
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4" />
            {t("secrets.certificate")}
          </h3>
          <TlsCertificateView pem={certificatePem} />
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Key className="size-4" />
            {t("configuration.data")}
            <span className="text-xs font-normal text-muted-foreground">
              {filtered.length}/{entries.length}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search")}
              aria-label={t("common.search")}
              className="h-7 w-48 text-xs"
            />
            {kind === "configmap" && (
              <Toggle
                size="sm"
                pressed={wrap}
                onPressedChange={setWrap}
                aria-label={t("logs.wrap")}
                title={t("logs.wrap")}
                className="h-7 px-2"
              >
                <WrapText className="size-3.5" />
              </Toggle>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
        ) : filtered.length > VIRTUALIZE_THRESHOLD ? (
          <VirtualizedRows entries={filtered} renderRow={renderRow} />
        ) : (
          <div className="space-y-4">
            {filtered.map((entry) => (
              <div key={entry.key}>{renderRow(entry)}</div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function VirtualizedRows({
  entries,
  renderRow,
}: {
  entries: DataEntry[];
  renderRow: (entry: DataEntry) => React.ReactNode;
}) {
  // Opt out of React Compiler memoization: useVirtualizer returns functions
  // that must not be memoized (react-hooks/incompatible-library).
  "use no memo";

  const scrollRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- informational: compiler skips this component ("use no memo")
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    getItemKey: (index) => entries[index].key,
    // Values differ wildly in height (one line vs a whole config file), so
    // rows are measured. 0 means not laid out yet (jsdom), keep the estimate.
    measureElement: (el) => el.getBoundingClientRect().height || ROW_ESTIMATE,
  });

  return (
    <div
      ref={scrollRef}
      data-testid="data-section-scroll"
      className="max-h-[60vh] overflow-y-auto"
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full pb-4"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            {renderRow(entries[item.index])}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DataRowProps {
  entry: DataEntry;
  kind: DataKind;
  wrap: boolean;
  revealed: boolean;
  copied: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  binaryLabel: string;
}

function DataRow({
  entry,
  kind,
  wrap,
  revealed,
  copied,
  onToggleReveal,
  onCopy,
  binaryLabel,
}: DataRowProps) {
  const secret = kind === "secret";

  return (
    <div className="space-y-1.5" data-testid="data-row">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground truncate">
          {entry.key}
          {entry.binary && (
            <span className="ml-2 text-xs font-normal uppercase tracking-wide">
              {binaryLabel}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="h-7 px-2"
            aria-label={`copy ${entry.key}`}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          {secret && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleReveal}
              className="h-7 px-2"
              aria-label={`reveal ${entry.key}`}
            >
              {revealed ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
      {secret ? (
        <div
          className="bg-muted/50 rounded-xl px-3 py-2 text-sm font-mono cursor-pointer hover:bg-muted/70 transition-colors"
          onClick={onToggleReveal}
          style={{
            filter: revealed ? "blur(0px)" : "blur(2px)",
            transition: "filter 300ms ease-in-out",
            userSelect: revealed ? "text" : "none",
          }}
        >
          <span className="break-all">
            {revealed ? decodeBase64(entry.value) : "••••••••"}
          </span>
        </div>
      ) : (
        <pre
          className={
            wrap
              ? "bg-muted/50 rounded-xl px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all"
              : "bg-muted/50 rounded-xl px-3 py-2 text-xs font-mono whitespace-pre overflow-x-auto"
          }
        >
          {entry.value}
        </pre>
      )}
    </div>
  );
}
