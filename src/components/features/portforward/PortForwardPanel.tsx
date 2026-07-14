"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type {
  PortForwardInfo,
  PortForwardStatus,
  PortForwardHistoryItem,
  PortForwardStopReason,
} from "@/lib/types";
import {
  ArrowRight,
  ExternalLink,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatRelativeTime } from "@/lib/utils";

interface PortForwardPanelProps {
  onClose?: () => void;
}

export function PortForwardPanel({ onClose }: PortForwardPanelProps) {
  const t = useTranslations("portForward");
  const {
    forwards,
    isLoading,
    error,
    startForward,
    stopForward,
    stopAllForwards,
  } = usePortForward();

  const history = usePortForwardStore((s) => s.history);
  const removeHistoryItem = usePortForwardStore((s) => s.removeHistoryItem);
  const clearHistoryForCurrentCluster = usePortForwardStore(
    (s) => s.clearHistoryForCurrentCluster
  );
  const restartFromHistory = usePortForwardStore((s) => s.restartFromHistory);
  const currentContext = useClusterStore((s) => s.currentCluster?.context);

  const visibleHistory = useMemo(
    () => history.filter((h) => h.cluster_context === currentContext),
    [history, currentContext]
  );

  const [showNewForm, setShowNewForm] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-2">
          {activeTab === "active" && (
            <>
              <Button size="sm" onClick={() => setShowNewForm(true)}>
                <Plus className="size-3" />
                {t("new")}
              </Button>
              {forwards.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopAllForwards}
                >
                  <Square className="size-3" />
                  {t("stopAll")}
                </Button>
              )}
            </>
          )}
          {activeTab === "history" && visibleHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistoryForCurrentCluster}
            >
              <Trash2 className="size-3" />
              {t("clearClusterHistory")}
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-4 pt-2 border-b border-border">
          <TabsList className="h-8">
            <TabsTrigger value="active" className="text-xs gap-1.5">
              {t("active")}
              {forwards.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  {forwards.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5">
              {t("history")}
              {visibleHistory.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  {visibleHistory.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Active tab content */}
        <TabsContent value="active" className="flex-1 overflow-auto p-4 mt-0">
          {showNewForm && (
            <NewPortForwardForm
              onSubmit={async (data) => {
                await startForward(
                  data.namespace,
                  data.name,
                  data.targetType,
                  data.targetPort,
                  data.localPort
                );
                setShowNewForm(false);
              }}
              onCancel={() => setShowNewForm(false)}
              isLoading={isLoading}
            />
          )}

          {forwards.length === 0 && !showNewForm ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">{t("noActive")}</p>
              <p className="text-xs mt-1">{t("noActiveHint")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {forwards.map((forward) => (
                <PortForwardItem
                  key={forward.forward_id}
                  forward={forward}
                  onStop={() => stopForward(forward.forward_id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* History tab content */}
        <TabsContent value="history" className="flex-1 overflow-auto p-4 mt-0">
          {visibleHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">{t("noHistory")}</p>
              <p className="text-xs mt-1">{t("noHistoryHint")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleHistory.map((item) => (
                <PortForwardHistoryRow
                  key={item.id}
                  item={item}
                  onRestart={() => restartFromHistory(item)}
                  onDelete={() => removeHistoryItem(item.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface PortForwardItemProps {
  forward: PortForwardInfo;
  onStop: () => void;
}

function PortForwardItem({ forward, onStop }: PortForwardItemProps) {
  const t = useTranslations("portForward");
  const tc = useTranslations("common");

  const getStatusLabel = (status: PortForwardStatus): string => {
    switch (status) {
      case "connecting":
        return t("connecting");
      case "connected":
        return t("connected");
      case "reconnecting":
        return t("reconnecting");
      case "disconnected":
        return t("disconnected");
      case "error":
        return tc("error");
    }
  };

  const statusColors: Record<PortForwardStatus, string> = {
    connecting: "bg-yellow-500",
    connected: "bg-green-500",
    reconnecting: "bg-orange-500",
    disconnected: "bg-muted-foreground",
    error: "bg-destructive",
  };

  const statusLabel = getStatusLabel(forward.status);

  const openInBrowser = async () => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(`http://localhost:${forward.local_port}`);
    } catch (err) {
      console.error("Failed to open browser:", err);
    }
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Status indicator */}
          <span
            className={cn(
              "size-2 rounded-full mt-1.5 shrink-0",
              statusColors[forward.status],
              (forward.status === "connecting" ||
                forward.status === "reconnecting") &&
                "animate-pulse"
            )}
            title={statusLabel}
          />

          {/* Forward info - takes remaining space */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Badge variant="secondary" className="text-xs shrink-0">
                {forward.target_type}
              </Badge>
              <span className="font-medium truncate">{forward.name}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {forward.namespace}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-mono flex-wrap">
              <span>localhost:{forward.local_port}</span>
              <ArrowRight className="size-3 shrink-0" />
              <span>:{forward.target_port}</span>
              {forward.port_name && (
                <span className="text-muted-foreground/60 font-sans">
                  ({forward.port_name})
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {forward.status === "connected" && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={openInBrowser}
                title={t("openBrowser")}
              >
                <ExternalLink className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onStop}
              title={t("stopForward")}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Square className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PortForwardHistoryRowProps {
  item: PortForwardHistoryItem;
  onRestart: () => void;
  onDelete: () => void;
}

function panelStopReasonLabel(
  reason: PortForwardStopReason | undefined,
  t: (key: string) => string,
): string | undefined {
  switch (reason) {
    case "user":
      return t("stopReasonUser");
    case "podDied":
      return t("stopReasonPodDied");
    case "error":
      return t("stopReasonError");
    case "disconnected":
      return t("stopReasonDisconnected");
    default:
      return undefined;
  }
}

function PortForwardHistoryRow({
  item,
  onRestart,
  onDelete,
}: PortForwardHistoryRowProps) {
  const t = useTranslations("portForward");

  const statusBadgeVariant = (
    status: PortForwardHistoryItem["status"]
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      case "error":
        return "destructive";
    }
  };

  const statusBadgeClass = (status: PortForwardHistoryItem["status"]): string => {
    if (status === "active") {
      return "bg-green-500 text-white hover:bg-green-500";
    }
    return "";
  };

  const reasonText = panelStopReasonLabel(item.stop_reason, t);
  const agoText =
    item.stopped_at !== undefined
      ? t("stoppedAgo", { time: formatRelativeTime(item.stopped_at, t("justNow")) })
      : undefined;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* History item info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Badge variant="secondary" className="text-xs shrink-0">
                {item.target_type}
              </Badge>
              <span className="font-medium truncate">{item.name}</span>
              <Badge
                variant={statusBadgeVariant(item.status)}
                className={cn("text-xs shrink-0", statusBadgeClass(item.status))}
              >
                {item.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {item.namespace}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-mono flex-wrap">
              <span>localhost:{item.local_port}</span>
              <ArrowRight className="size-3 shrink-0" />
              <span>:{item.target_port}</span>
            </div>
            {(reasonText || agoText) && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {[reasonText, agoText].filter(Boolean).join(" • ")}
              </div>
            )}
            {item.error_message && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-xs text-red-500/80 mt-0.5 truncate cursor-default">
                    {item.error_message}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm wrap-break-word">
                  {item.error_message}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Three-dot actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Row actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRestart}>
                <RotateCcw className="size-3.5 mr-2" />
                {t("startAgain")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" />
                {t("deleteFromHistory")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

interface NewPortForwardFormProps {
  onSubmit: (data: {
    namespace: string;
    name: string;
    targetType: "pod" | "service";
    targetPort: number;
    localPort?: number;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

function NewPortForwardForm({
  onSubmit,
  onCancel,
  isLoading,
}: NewPortForwardFormProps) {
  const t = useTranslations("portForward");
  const tc = useTranslations("common");
  const tn = useTranslations("cluster");

  const [namespace, setNamespace] = useState("");
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<"pod" | "service">("pod");
  const [targetPort, setTargetPort] = useState("");
  const [localPort, setLocalPort] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      namespace,
      name,
      targetType,
      targetPort: parseInt(targetPort, 10),
      localPort: localPort ? parseInt(localPort, 10) : undefined,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t("newForward")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="targetType">{tc("type")}</Label>
              <Select
                value={targetType}
                onValueChange={(value) =>
                  setTargetType(value as "pod" | "service")
                }
              >
                <SelectTrigger id="targetType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pod">Pod</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="namespace">{tn("namespace")}</Label>
              <Input
                id="namespace"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                placeholder="default"
                required
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">
                {targetType === "pod" ? t("podName") : t("serviceName")}
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-pod"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetPort">{t("targetPort")}</Label>
              <Input
                id="targetPort"
                type="number"
                value={targetPort}
                onChange={(e) => setTargetPort(e.target.value)}
                placeholder="8080"
                required
                min={1}
                max={65535}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="localPort">
                {t("localPort")} ({tc("optional").toLowerCase()})
              </Label>
              <Input
                id="localPort"
                type="number"
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                placeholder="Auto"
                min={1024}
                max={65535}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("starting") : t("start")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
