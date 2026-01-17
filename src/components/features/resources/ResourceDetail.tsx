"use client";

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import "@/lib/monaco-config";
import {
  X,
  Save,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  FileJson,
  Info,
  Activity,
  Tag,
  FileText,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";
import { LogViewer } from "../logs/LogViewer";

export interface ResourceDetailProps {
  resource: ResourceData | null;
  resourceType: string;
  onClose: () => void;
  onSave?: (yaml: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  isLoading?: boolean;
}

export interface ResourceData {
  name: string;
  namespace?: string;
  uid: string;
  apiVersion?: string;
  kind?: string;
  createdAt?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  yaml?: string;
  status?: Record<string, unknown>;
  spec?: Record<string, unknown>;
  conditions?: Condition[];
  events?: K8sEvent[];
}

interface Condition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

interface K8sEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  lastTimestamp?: string;
  firstTimestamp?: string;
}

export function ResourceDetail({
  resource,
  resourceType,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
}: ResourceDetailProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState("overview");
  const [yamlContent, setYamlContent] = useState("");
  const [originalYaml, setOriginalYaml] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { resolvedTheme } = useUIStore();

  useEffect(() => {
    if (resource?.yaml) {
      setYamlContent(resource.yaml);
      setOriginalYaml(resource.yaml);
      setHasChanges(false);
    }
  }, [resource?.yaml]);

  const handleYamlChange = (value: string | undefined) => {
    if (value !== undefined) {
      setYamlContent(value);
      setHasChanges(value !== originalYaml);
    }
  };

  const handleSave = async () => {
    if (!onSave || !hasChanges) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(yamlContent);
      setOriginalYaml(yamlContent);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setYamlContent(originalYaml);
    setHasChanges(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setError(null);
    try {
      await onDelete();
      setShowDeleteDialog(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("messages.deleteError", { name: resource?.name || "" })
      );
      setShowDeleteDialog(false);
    }
  };

  const handleCopyYaml = async () => {
    await navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    toast.success(t("messages.copySuccess"));
    setTimeout(() => setCopied(false), 2000);
  };

  if (!resource) return null;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold">{resource.name}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{resourceType}</Badge>
              {resource.namespace && <span>in {resource.namespace}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
              >
                <RotateCcw className="size-4" />
                {t("common.reset")}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isLoading}
              >
                <Save className="size-4" />
                {isSaving ? `${t("common.loading")}` : t("common.save")}
              </Button>
            </>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              {t("common.delete")}
            </Button>
          )}
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-4 pt-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border px-4 py-2">
          <TabsList className="h-10">
            <TabsTrigger value="overview" className="gap-2">
              <Info className="size-4" />
              {t("resourceDetail.overview")}
            </TabsTrigger>
            <TabsTrigger value="yaml" className="gap-2">
              <FileJson className="size-4" />
              {t("resourceDetail.yaml")}
            </TabsTrigger>
            {resourceType === "pod" && resource.namespace && (
              <TabsTrigger value="logs" className="gap-2">
                <FileText className="size-4" />
                {t("resourceDetail.logs")}
              </TabsTrigger>
            )}
            {resource.conditions && resource.conditions.length > 0 && (
              <TabsTrigger value="conditions" className="gap-2">
                <Activity className="size-4" />
                {t("resourceDetail.conditions")}
              </TabsTrigger>
            )}
            {resource.events && resource.events.length > 0 && (
              <TabsTrigger value="events" className="gap-2">
                <AlertCircle className="size-4" />
                {t("resourceDetail.events")}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Metadata Section */}
              <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Info className="size-4" />
                  {t("resourceDetail.metadata")}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <MetadataItem label={t("common.name")} value={resource.name} />
                  {resource.namespace && (
                    <MetadataItem
                      label={t("cluster.namespace")}
                      value={resource.namespace}
                    />
                  )}
                  <MetadataItem label="UID" value={resource.uid} mono />
                  {resource.createdAt && (
                    <MetadataItem
                      label={t("common.age")}
                      value={formatDate(resource.createdAt)}
                    />
                  )}
                  {resource.apiVersion && (
                    <MetadataItem
                      label="API Version"
                      value={resource.apiVersion}
                    />
                  )}
                  {resource.kind && (
                    <MetadataItem label={t("common.type")} value={resource.kind} />
                  )}
                </div>
              </section>

              {/* Labels Section */}
              {resource.labels && Object.keys(resource.labels).length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Tag className="size-4" />
                    {t("common.labels")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(resource.labels).map(([key, value]) => (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="font-mono text-xs"
                      >
                        {key}={value}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Annotations Section */}
              {resource.annotations &&
                Object.keys(resource.annotations).length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold mb-3">{t("common.annotations")}</h3>
                    <div className="space-y-2">
                      {Object.entries(resource.annotations).map(
                        ([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-mono text-muted-foreground">
                              {key}
                            </span>
                            <p className="mt-0.5 break-all">{value}</p>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}

              {/* Status Section */}
              {resource.status && Object.keys(resource.status).length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Activity className="size-4" />
                    {t("common.status")}
                  </h3>
                  <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto">
                    {JSON.stringify(resource.status, null, 2)}
                  </pre>
                </section>
              )}

              {/* Spec Section */}
              {resource.spec && Object.keys(resource.spec).length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-3">{t("resourceDetail.spec")}</h3>
                  <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto">
                    {JSON.stringify(resource.spec, null, 2)}
                  </pre>
                </section>
              )}

              {/* Secret Data Section */}
              {resourceType === "secret" && resource.yaml && (
                <SecretDataSection yaml={resource.yaml} />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* YAML Tab */}
        <TabsContent
          value="yaml"
          forceMount
          className={cn(
            "flex-1 overflow-hidden m-0 flex flex-col",
            activeTab !== "yaml" && "hidden"
          )}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {hasChanges ? t("resourceDetail.editYaml") : "—"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyYaml}
              className="h-7 text-xs"
            >
              {copied ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={yamlContent}
              onChange={handleYamlChange}
              theme={
                resolvedTheme === "dark" || resolvedTheme === "classic-dark"
                  ? "vs-dark"
                  : "light"
              }
              loading={
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t("common.loading")}
                </div>
              }
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "off",
                readOnly: !onSave,
                smoothScrolling: false,
                renderWhitespace: "none",
                renderLineHighlight: "none",
                renderLineHighlightOnlyWhenFocus: true,
                quickSuggestions: false,
                folding: true,
                foldingHighlight: false,
                matchBrackets: "never",
                occurrencesHighlight: "off",
                selectionHighlight: false,
                codeLens: false,
                contextmenu: false,
                fontLigatures: false,
                renderValidationDecorations: "off",
                cursorBlinking: "solid",
                cursorSmoothCaretAnimation: "off",
                guides: {
                  indentation: false,
                  bracketPairs: false,
                  highlightActiveIndentation: false,
                },
                colorDecorators: false,
                links: false,
                hover: { enabled: false },
                parameterHints: { enabled: false },
                suggestOnTriggerCharacters: false,
                acceptSuggestionOnEnter: "off",
                inlineSuggest: { enabled: false },
                scrollbar: {
                  vertical: "visible",
                  horizontal: "visible",
                  useShadows: false,
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
              }}
            />
          </div>
        </TabsContent>

        {/* Logs Tab (only for pods) */}
        {resourceType === "pod" && resource.namespace && (
          <TabsContent value="logs" className="flex-1 overflow-hidden m-0">
            <LogViewer namespace={resource.namespace} podName={resource.name} />
          </TabsContent>
        )}

        {/* Conditions Tab */}
        {resource.conditions && resource.conditions.length > 0 && (
          <TabsContent
            value="conditions"
            className="flex-1 overflow-hidden m-0"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {resource.conditions.map((condition, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-lg border p-3",
                      condition.status === "True"
                        ? "border-green-500/30 bg-green-500/5"
                        : condition.status === "False"
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-border bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{condition.type}</span>
                      <Badge
                        variant={
                          condition.status === "True" ? "default" : "secondary"
                        }
                        className={cn(
                          condition.status === "True" && "bg-green-500",
                          condition.status === "False" && "bg-red-500"
                        )}
                      >
                        {condition.status}
                      </Badge>
                    </div>
                    {condition.reason && (
                      <p className="text-sm text-muted-foreground">
                        Reason: {condition.reason}
                      </p>
                    )}
                    {condition.message && (
                      <p className="text-sm mt-1">{condition.message}</p>
                    )}
                    {condition.lastTransitionTime && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last transition:{" "}
                        {formatDate(condition.lastTransitionTime)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        {/* Events Tab */}
        {resource.events && resource.events.length > 0 && (
          <TabsContent value="events" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {resource.events.map((event, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-lg border p-3",
                      event.type === "Warning"
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-border bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{event.reason}</span>
                      <div className="flex items-center gap-2">
                        {event.count > 1 && (
                          <Badge variant="secondary">{event.count}x</Badge>
                        )}
                        <Badge
                          variant={
                            event.type === "Warning"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {event.type}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm">{event.message}</p>
                    {event.lastTimestamp && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last seen: {formatDate(event.lastTimestamp)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")} {resourceType}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t("messages.confirmDelete", { name: resource.name })}
              {resource.namespace && (
                <>
                  {" "}
                  ({t("cluster.namespace")}: <strong>{resource.namespace}</strong>)
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetadataItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

interface SecretData {
  type: string;
  data: Record<string, string>;
}

function parseSecretFromYaml(yaml: string): SecretData | null {
  try {
    // Simple YAML parsing for secrets
    const lines = yaml.split("\n");
    let secretType = "Opaque";
    const data: Record<string, string> = {};
    let inDataSection = false;
    let currentKey = "";
    let currentValue = "";

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for type field
      if (trimmed.startsWith("type:")) {
        secretType = trimmed.replace("type:", "").trim();
        continue;
      }

      // Check for data section start
      if (trimmed === "data:" || trimmed.startsWith("data:")) {
        inDataSection = true;
        // Check if data is on same line (e.g., "data: {}")
        if (trimmed !== "data:") {
          inDataSection = false;
        }
        continue;
      }

      // Check for stringData section (also valid for secrets)
      if (trimmed === "stringData:" || trimmed.startsWith("stringData:")) {
        inDataSection = true;
        continue;
      }

      // Exit data section if we hit another top-level key
      if (
        inDataSection &&
        !line.startsWith(" ") &&
        !line.startsWith("\t") &&
        trimmed !== ""
      ) {
        inDataSection = false;
      }

      // Parse data entries
      if (inDataSection && trimmed !== "") {
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > 0) {
          currentKey = trimmed.substring(0, colonIndex).trim();
          currentValue = trimmed.substring(colonIndex + 1).trim();

          // Remove quotes if present
          if (
            (currentValue.startsWith('"') && currentValue.endsWith('"')) ||
            (currentValue.startsWith("'") && currentValue.endsWith("'"))
          ) {
            currentValue = currentValue.slice(1, -1);
          }

          if (currentKey && currentValue) {
            data[currentKey] = currentValue;
          }
        }
      }
    }

    return { type: secretType, data };
  } catch {
    return null;
  }
}

function decodeBase64(value: string): string {
  try {
    return atob(value);
  } catch {
    return value; // Return original if not valid base64
  }
}

function SecretDataSection({ yaml }: { yaml: string }) {
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
        // Hide: clear timeout if exists
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
        // Reveal: set auto-hide timeout
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
