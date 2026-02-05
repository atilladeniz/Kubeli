"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TRUNCATE_LENGTH = 120;

interface AnnotationsSectionProps {
  annotations: Record<string, string>;
  label: string;
  copyToastMessage?: string;
}

export function AnnotationsSection({ annotations, label, copyToastMessage = "Copied" }: AnnotationsSectionProps) {
  return (
    <section>
      <h3 className="text-sm font-semibold mb-3">{label}</h3>
      <div className="space-y-3">
        {Object.entries(annotations).map(([key, value]) => (
          <AnnotationEntry key={key} annotationKey={key} value={value} copyToastMessage={copyToastMessage} />
        ))}
      </div>
    </section>
  );
}

function AnnotationEntry({
  annotationKey,
  value,
  copyToastMessage,
}: {
  annotationKey: string;
  value: string;
  copyToastMessage: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLong = value.length > TRUNCATE_LENGTH;
  const isJson = isLong && (value.startsWith("{") || value.startsWith("["));

  const displayValue = useMemo(() => {
    if (!isExpanded && isLong) return value.slice(0, TRUNCATE_LENGTH) + "\u2026";
    if (isExpanded && isJson) {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }, [isExpanded, isLong, isJson, value]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(copyToastMessage);
    setTimeout(() => setCopied(false), 2000);
  }, [value, copyToastMessage]);

  return (
    <div className="group text-sm">
      <div className="flex items-center gap-1">
        <span className="font-mono text-muted-foreground min-w-0 break-all">{annotationKey}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
      {isExpanded && isJson ? (
        <pre className="mt-1 bg-muted/50 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
          {displayValue}
        </pre>
      ) : (
        <p className="mt-0.5 break-all">{displayValue}</p>
      )}
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-primary hover:underline mt-0.5 inline-flex items-center gap-0.5"
        >
          {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
