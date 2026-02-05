"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  File,
  Folder,
  Keyboard,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Plus,
  HelpCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  getKubeconfigSources,
  addKubeconfigSource,
  removeKubeconfigSource,
  listKubeconfigSources,
  setKubeconfigMergeMode,
  type KubeconfigSourcesConfig,
  type KubeconfigSourceInfo,
} from "@/lib/tauri/commands";
import { useClusterStore } from "@/lib/stores/cluster-store";

export function KubeconfigTab() {
  const t = useTranslations("settings");
  const fetchClusters = useClusterStore((s) => s.fetchClusters);
  const [config, setConfig] = useState<KubeconfigSourcesConfig | null>(null);
  const [sourceInfos, setSourceInfos] = useState<KubeconfigSourceInfo[]>([]);
  const [showPathInput, setShowPathInput] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    try {
      const [cfg, infos] = await Promise.all([
        getKubeconfigSources(),
        listKubeconfigSources(),
      ]);
      setConfig(cfg);
      setSourceInfos(infos);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  // Reload sources + refresh cluster list so changes are visible immediately
  const reloadSourcesAndClusters = useCallback(async () => {
    await loadSources();
    await fetchClusters();
    // Notify watcher to restart with updated source paths
    window.dispatchEvent(new Event("kubeconfig-sources-changed"));
  }, [loadSources, fetchClusters]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleAddFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Kubeconfig",
            extensions: ["yaml", "yml", "conf", "config", "*"],
          },
        ],
      });
      if (selected) {
        const path = typeof selected === "string" ? selected : selected;
        await addKubeconfigSource(path as string, "file");
        await reloadSourcesAndClusters();
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleAddFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true });
      if (selected) {
        await addKubeconfigSource(selected as string, "folder");
        await reloadSourcesAndClusters();
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleAddManualPath = async () => {
    if (!manualPath.trim()) return;
    try {
      await addKubeconfigSource(manualPath.trim(), "file");
      setManualPath("");
      setShowPathInput(false);
      await reloadSourcesAndClusters();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleRemove = async (path: string) => {
    try {
      await removeKubeconfigSource(path);
      await reloadSourcesAndClusters();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleMergeModeChange = async (enabled: boolean) => {
    try {
      const updated = await setKubeconfigMergeMode(enabled);
      setConfig(updated);
      await fetchClusters();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6">
      {/* Kubeconfig Sources */}
      <div className="space-y-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            {t("kubeconfig.sources.title")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("kubeconfig.sources.description")}
          </p>
        </div>

        {/* Source list */}
        <div className="space-y-2">
          {sourceInfos.map((info) => (
            <div
              key={info.path}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <div className="shrink-0">
                {info.source_type === "folder" ? (
                  <Folder className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <File className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono truncate">{info.path}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {info.valid ? (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle2 className="h-3 w-3" />
                      {info.file_count}{" "}
                      {info.file_count === 1
                        ? t("kubeconfig.sources.file")
                        : t("kubeconfig.sources.files")}
                      ,{" "}
                      {info.context_count}{" "}
                      {info.context_count === 1
                        ? t("kubeconfig.sources.context")
                        : t("kubeconfig.sources.contexts")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {info.error || t("kubeconfig.sources.invalid")}
                    </span>
                  )}
                </div>
              </div>
              {!info.is_default && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => setDeleteTarget(info.path)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Add buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleAddFile}>
            <File className="h-3.5 w-3.5 mr-1.5" />
            {t("kubeconfig.sources.addFile")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleAddFolder}>
            <Folder className="h-3.5 w-3.5 mr-1.5" />
            {t("kubeconfig.sources.addFolder")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPathInput(!showPathInput)}
          >
            <Keyboard className="h-3.5 w-3.5 mr-1.5" />
            {t("kubeconfig.sources.enterPath")}
          </Button>
        </div>

        {/* Manual path input */}
        {showPathInput && (
          <div className="flex gap-2">
            <Input
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder={t("kubeconfig.sources.pathPlaceholder")}
              className="flex-1 font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddManualPath();
              }}
            />
            <Button size="sm" onClick={handleAddManualPath}>
              <Plus className="h-3.5 w-3.5" />
              {t("kubeconfig.sources.add")}
            </Button>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>

      <Separator />

      {/* Merge Mode */}
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-0.5 max-w-[85%]">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium">
              {t("kubeconfig.mergeMode.title")}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm" side="top">
                <div className="space-y-2">
                  <p className="font-medium">{t("kubeconfig.mergeMode.helpTitle")}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("kubeconfig.mergeMode.helpDescription")}
                  </p>
                  <div className="rounded-md bg-muted p-2 font-mono text-xs space-y-1">
                    <p className="text-muted-foreground"># contexts.yaml</p>
                    <p>contexts: [{`{ name: prod, cluster: prod-cluster }`}]</p>
                    <p className="text-muted-foreground mt-1"># clusters.yaml</p>
                    <p>clusters: [{`{ name: prod-cluster, server: ... }`}]</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("kubeconfig.mergeMode.description")}
          </p>
        </div>
        <Switch
          className="shrink-0 mt-1"
          checked={config?.merge_mode ?? false}
          onCheckedChange={handleMergeModeChange}
        />
      </div>
      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("kubeconfig.sources.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("kubeconfig.sources.deleteDescription")}
              <span className="block mt-1 font-mono text-xs">
                {deleteTarget}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("kubeconfig.sources.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) handleRemove(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              {t("kubeconfig.sources.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
