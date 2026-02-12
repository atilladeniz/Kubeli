"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePortForward } from "@/lib/hooks/usePortForward";
import type { PortForwardInfo, PortForwardStatus } from "@/lib/types";
import { ArrowRight, ExternalLink, Plus, Square, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  } = usePortForward({
    onError: (forwardId, message) => {
      console.error(`Port forward ${forwardId} error:`, message);
    },
  });

  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowNewForm(true)}
          >
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
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
            >
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
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
      </div>
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

  const openInBrowser = () => {
    window.open(`http://localhost:${forward.local_port}`, "_blank");
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <span
              className={cn(
                "size-2 rounded-full",
                statusColors[forward.status],
                (forward.status === "connecting" || forward.status === "reconnecting") && "animate-pulse"
              )}
              title={statusLabel}
            />

            {/* Forward info */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="text-xs">
                  {forward.target_type}
                </Badge>
                <span className="font-medium">
                  {forward.namespace}/{forward.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">localhost:{forward.local_port}</span>
                <ArrowRight className="size-3" />
                <span className="font-mono">:{forward.target_port}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
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
        <CardTitle className="text-sm">{t("newForward")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="targetType">{tc("type")}</Label>
              <Select
                value={targetType}
                onValueChange={(value) => setTargetType(value as "pod" | "service")}
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
              <Label htmlFor="localPort">{t("localPort")} ({tc("optional").toLowerCase()})</Label>
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
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? t("starting") : t("start")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
