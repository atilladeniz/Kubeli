"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseSecretFromYaml, decodeBase64 } from "../lib/utils";

export function SecretDataSection({ yaml }: { yaml: string }) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [timeouts, setTimeouts] = useState<Map<string, NodeJS.Timeout>>(
    new Map()
  );

  const secretData = parseSecretFromYaml(yaml);

  if (!secretData || Object.keys(secretData.data).length === 0) {
    return null;
  }

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        const existingTimeout = timeouts.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          setTimeouts((t) => {
            const newTimeouts = new Map(t);
            newTimeouts.delete(key);
            return newTimeouts;
          });
        }
        next.delete(key);
      } else {
        next.add(key);
        const timeout = setTimeout(() => {
          setRevealedKeys((current) => {
            const updated = new Set(current);
            updated.delete(key);
            return updated;
          });
          setTimeouts((t) => {
            const newTimeouts = new Map(t);
            newTimeouts.delete(key);
            return newTimeouts;
          });
        }, 10000);
        setTimeouts((t) => {
          const newTimeouts = new Map(t);
          newTimeouts.set(key, timeout);
          return newTimeouts;
        });
      }
      return next;
    });
  };

  const copyValue = async (key: string, value: string) => {
    const decoded = decodeBase64(value);
    await navigator.clipboard.writeText(decoded);
    setCopiedKey(key);
    toast.success("Value copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <>
      {/* Type Section */}
      <section>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
          Type
        </h3>
        <p className="text-base font-medium">{secretData.type}</p>
      </section>

      {/* Data Section */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Key className="size-4" />
          Data
        </h3>
        <div className="space-y-4">
          {Object.entries(secretData.data).map(([key, value]) => {
            const isRevealed = revealedKeys.has(key);
            const decodedValue = decodeBase64(value);
            const isCopied = copiedKey === key;

            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {key}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyValue(key, value)}
                      className="h-7 px-2"
                    >
                      {isCopied ? (
                        <Check className="size-3.5 text-green-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleReveal(key)}
                      className="h-7 px-2"
                    >
                      {isRevealed ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <div
                  className="bg-muted/50 rounded-lg px-3 py-2 text-sm font-mono cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => toggleReveal(key)}
                  style={{
                    filter: isRevealed ? "blur(0px)" : "blur(2px)",
                    transition: "filter 300ms ease-in-out",
                    borderRadius: "12px",
                    userSelect: isRevealed ? "text" : "none",
                  }}
                >
                  <span className="break-all">
                    {isRevealed ? decodedValue : "••••••••"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
