"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Trash2,
  AlertCircle,
  FileJson,
  Info,
  Activity,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LogViewer } from "../logs/LogViewer";
import { OverviewTab } from "./components/OverviewTab";
import { YamlTab, type YamlTabHandle } from "./components/YamlTab";
import { ConditionsTab } from "./components/ConditionsTab";
import { EventsTab } from "./components/EventsTab";
import { DangerZoneTab } from "./components/DangerZoneTab";
import { DeleteResourceDialog } from "./dialogs/DeleteResourceDialog";
import { DiscardChangesDialog } from "./dialogs/DiscardChangesDialog";

export type { ResourceDetailProps, ResourceData } from "./types";
import type { ResourceDetailProps } from "./types";

function normalizeYamlForCompare(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\n$/, "");
}

export function ResourceDetail({
  resource,
  resourceType: rawResourceType,
  onClose,
  onSave,
  onDelete,
}: ResourceDetailProps) {
  const t = useTranslations();
  // Normalize plural forms (e.g. "pods" → "pod") so tab conditions work
  // regardless of whether the detail was opened from a list or a favorite shortcut.
  const resourceType = rawResourceType.replace(/s$/, "");
  const yamlTabRef = useRef<YamlTabHandle>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    requestAnimationFrame(() => {
      const container = tabsContainerRef.current;
      const active = container?.querySelector<HTMLElement>(`[data-state="active"]`);
      if (active && container) {
        active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    });
  }, []);
  const [yamlContent, setYamlContent] = useState("");
  const [originalYaml, setOriginalYaml] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDiscardOnClose, setShowDiscardOnClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hasChanges =
    normalizeYamlForCompare(yamlContent) !==
    normalizeYamlForCompare(originalYaml);

  // Reset to overview tab when switching to a different resource
  useEffect(() => {
    setActiveTab("overview");
  }, [resource?.uid]);

  useEffect(() => {
    if (resource?.yaml) {
      setYamlContent(resource.yaml);
      setOriginalYaml(resource.yaml);
    }
  }, [resource?.yaml]);

  const handleYamlChange = (value: string | undefined) => {
    if (value !== undefined) {
      setYamlContent(value);
    }
  };

  const handleSave = async () => {
    if (!onSave || !hasChanges) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(yamlContent);
      setOriginalYaml(yamlContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.saveError"));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setYamlContent(originalYaml);
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
        err instanceof Error
          ? err.message
          : t("messages.deleteError", { name: resource?.name || "" }),
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

  const handleClose = () => {
    if (hasChanges) {
      setShowDiscardOnClose(true);
    } else {
      onClose();
    }
  };

  const handleDiscardCloseChange = (open: boolean) => {
    setShowDiscardOnClose(open);
    if (!open) yamlTabRef.current?.focusEditor();
  };

  const handleConfirmClose = () => {
    setShowDiscardOnClose(false);
    onClose();
  };

  if (!resource) return null;

  return (
    <div className="flex h-full flex-col bg-background min-w-0 overflow-hidden">
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
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="size-4" />
        </Button>
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
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div ref={tabsContainerRef} className="border-b border-border px-4 py-2 overflow-x-auto hide-scrollbar">
          <TabsList className="h-10 w-max">
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
            {onDelete && (
              <TabsTrigger
                value="danger"
                className="gap-2 text-destructive data-[state=active]:text-destructive"
              >
                <Trash2 className="size-4" />
                {t("resourceDetail.dangerZone")}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-hidden m-0">
          <OverviewTab resource={resource} resourceType={resourceType} />
        </TabsContent>

        <TabsContent
          value="yaml"
          forceMount
          className={cn(
            "flex-1 overflow-hidden m-0 flex flex-col",
            activeTab !== "yaml" && "hidden",
          )}
        >
          <YamlTab
            ref={yamlTabRef}
            yamlContent={yamlContent}
            hasChanges={hasChanges}
            onYamlChange={handleYamlChange}
            onCopyYaml={handleCopyYaml}
            onSave={handleSave}
            onReset={handleReset}
            copied={copied}
            canEdit={!!onSave}
            isSaving={isSaving}
            isActive={activeTab === "yaml"}
            resourceKey={resource.uid}
          />
        </TabsContent>

        {resourceType === "pod" && resource.namespace && (
          <TabsContent value="logs" className="flex-1 overflow-hidden m-0">
            <LogViewer
              namespace={resource.namespace}
              podName={resource.name}
              logTabId={`detail-${resource.namespace}-${resource.name}`}
            />
          </TabsContent>
        )}

        {resource.conditions && resource.conditions.length > 0 && (
          <TabsContent
            value="conditions"
            className="flex-1 overflow-hidden m-0"
          >
            <ConditionsTab conditions={resource.conditions} />
          </TabsContent>
        )}

        {resource.events && resource.events.length > 0 && (
          <TabsContent value="events" className="flex-1 overflow-hidden m-0">
            <EventsTab events={resource.events} />
          </TabsContent>
        )}

        {onDelete && (
          <TabsContent value="danger" className="flex-1 overflow-hidden m-0">
            <DangerZoneTab
              resourceName={resource.name}
              resourceType={resourceType}
              onDeleteClick={() => setShowDeleteDialog(true)}
            />
          </TabsContent>
        )}
      </Tabs>

      <DiscardChangesDialog
        open={showDiscardOnClose}
        onOpenChange={handleDiscardCloseChange}
        onConfirm={handleConfirmClose}
      />

      <DeleteResourceDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        resourceName={resource.name}
        resourceType={resourceType}
        namespace={resource.namespace}
      />
    </div>
  );
}
