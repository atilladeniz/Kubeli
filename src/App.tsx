import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  Server,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Settings,
  ArrowRightLeft,
  Search,
  SearchX,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ClusterIcon } from "@/components/ui/cluster-icon";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { useUpdater } from "@/lib/hooks/useUpdater";
import { useKubeconfigWatcher } from "@/lib/hooks/useKubeconfigWatcher";
import { usePlatform } from "@/lib/hooks/usePlatform";
import { Dashboard } from "@/components/features/dashboard";
import { SettingsPanel } from "@/components/features/settings/SettingsPanel";
import { RestartDialog } from "@/components/features/updates/RestartDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { generateDebugLog } from "@/lib/tauri/commands";
import packageJson from "../package.json";

// Check if we're in Tauri environment
function checkIsTauri(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.VITE_TAURI_MOCK === "true") {
    return true;
  }
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export default function Home() {
  const t = useTranslations("cluster");
  const tc = useTranslations("common");
  const tu = useTranslations("updates");
  const tw = useTranslations("welcome");
  const td = useTranslations("debug");

  const [isReady, setIsReady] = useState(false);
  const [isTauri, setIsTauri] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isDownloadingDebugLog, setIsDownloadingDebugLog] = useState(false);
  const [connectingContext, setConnectingContext] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const initialFetchDone = useRef(false);
  const { isWindows } = usePlatform();
  const kubeconfigPath = isWindows
    ? "C:\\Users\\<username>\\.kube\\config"
    : "~/.kube/config";

  // Watch kubeconfig source paths for filesystem changes (new/modified/deleted files)
  useKubeconfigWatcher();

  const {
    clusters,
    currentCluster,
    isConnected,
    isLoading: isClusterLoading,
    error,
    fetchClusters,
    connect,
    lastConnectionErrorContext,
    lastConnectionErrorMessage,
  } = useClusterStore();

  const searchLower = searchQuery.toLowerCase();
  const filteredClusters = clusters.filter(
    (cluster) =>
      cluster.name.toLowerCase().includes(searchLower) ||
      cluster.context.toLowerCase().includes(searchLower),
  );

  const canDownloadDebugLog = Boolean(
    isTauri &&
    error &&
    lastConnectionErrorContext &&
    lastConnectionErrorMessage &&
    error === lastConnectionErrorMessage,
  );

  const handleDownloadDebugLog = async () => {
    if (!lastConnectionErrorContext || !canDownloadDebugLog) {
      toast.error(td("onlyAvailable"));
      return;
    }

    setIsDownloadingDebugLog(true);
    try {
      const logContent = await generateDebugLog(
        lastConnectionErrorContext,
        lastConnectionErrorMessage ?? error ?? undefined,
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const defaultName = `kubeli-debug-${timestamp}.log`;
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "Log Files", extensions: ["log", "txt"] }],
      });

      if (!filePath) {
        return;
      }

      await writeTextFile(filePath, logContent);
      const filename = filePath.split(/[/\\]/).pop() ?? filePath;
      toast.success(td("logSaved"), { description: filename });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(td("logFailed"), { description: message });
      console.error("Failed to generate debug log:", err);
    } finally {
      setIsDownloadingDebugLog(false);
    }
  };

  // Handle cluster connection with local loading state
  const handleConnect = async (context: string) => {
    setConnectingContext(context);
    try {
      await connect(context);
    } finally {
      setConnectingContext(null);
    }
  };

  const { setSettingsOpen } = useUIStore();
  const { forwards } = usePortForward();
  const {
    available,
    update,
    downloading,
    progress,
    readyToRestart,
    downloadComplete,
    downloadAndInstall,
    restartNow,
  } = useUpdater();

  // Initialize app - check Tauri and fetch clusters
  useEffect(() => {
    const initialize = async () => {
      // Check for Tauri
      const tauriAvailable = checkIsTauri();
      if (!tauriAvailable) {
        // Wait a bit and check again (Tauri might not be ready immediately)
        await new Promise((resolve) => setTimeout(resolve, 50));
        const retryCheck = checkIsTauri();
        setIsTauri(retryCheck);
        if (!retryCheck) {
          setIsReady(true);
          return;
        }
      } else {
        setIsTauri(true);
      }

      // Fetch clusters before showing UI
      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        await fetchClusters();
      }

      // Show content
      setIsReady(true);
    };

    initialize();
  }, [fetchClusters]);

  // Listen for deep-link auto-connect events (kubeli://connect/<context>)
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ context: string }>("auto-connect", async (event) => {
        const ctx = event.payload.context;
        if (ctx) {
          await fetchClusters();
          await connect(ctx);
        }
      }).then((fn) => {
        unlisten = fn;
      });
    });
    return () => {
      unlisten?.();
    };
  }, [isTauri, fetchClusters, connect]);

  // Disable native context menu globally
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Allow context menu in areas that explicitly opt in
      if (target.closest("[data-allow-context-menu]")) {
        return;
      }
      // Allow context menu on inputs for copy/paste
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Prevent app-wide Select All; keep Cmd/Ctrl+A only for editable targets.
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
        return true;
      if (
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      )
        return true;
      if (target.closest('[role="textbox"]')) return true;
      return false;
    };

    const handleSelectAll = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "a") return;
      if (e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    document.addEventListener("keydown", handleSelectAll, true);
    return () => document.removeEventListener("keydown", handleSelectAll, true);
  }, []);

  // Show dashboard when connected
  useEffect(() => {
    if (isConnected) {
      queueMicrotask(() => {
        setShowDashboard(true);
      });
    }
  }, [isConnected]);

  // Show full dashboard when connected
  if (showDashboard && isConnected) {
    return <Dashboard />;
  }

  return (
    <div
      className={`flex h-screen flex-col bg-background text-foreground transition-opacity duration-200 ${
        isReady ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Titlebar safe area - pl-20 for macOS traffic lights */}
      <div
        data-tauri-drag-region
        className="flex h-7 shrink-0 items-center justify-center border-b border-border px-6"
      >
        <span
          className="text-xs text-muted-foreground/70"
          data-tauri-drag-region
        >
          Kubeli
        </span>
        <div className="absolute right-2 flex items-center gap-1">
          {available && update && (
            <Button
              variant="default"
              size="sm"
              className="h-5 text-[10px] px-2 py-0"
              onClick={() =>
                readyToRestart || downloadComplete
                  ? restartNow()
                  : downloadAndInstall()
              }
              disabled={downloading}
            >
              {downloading
                ? `${Math.round(progress)}%`
                : readyToRestart || downloadComplete
                  ? tu("restartNow")
                  : tu("updateNow")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex flex-1 flex-col gap-6 overflow-auto p-6">
        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4" />
              <AlertDescription>{error}</AlertDescription>
            </div>
            {canDownloadDebugLog && (
              <div className="flex flex-wrap gap-2 pl-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadDebugLog}
                  disabled={isDownloadingDebugLog}
                  className="gap-2"
                >
                  {isDownloadingDebugLog ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {td("saving")}
                    </>
                  ) : (
                    td("downloadLog")
                  )}
                </Button>
              </div>
            )}
          </Alert>
        )}

        {/* Clusters Section */}
        {isTauri && (
          <section className="mx-auto w-full max-w-4xl space-y-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{t("selectCluster")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("selectClusterDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder={t("searchClustersPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchClusters()}
                  disabled={isClusterLoading}
                >
                  <RefreshCw
                    className={`size-4 ${isClusterLoading ? "animate-spin" : ""}`}
                  />
                  {tc("refresh")}
                </Button>
              </div>
            </div>

            {clusters.length === 0 && !isClusterLoading ? (
              <Card className="text-center">
                <CardContent className="py-12">
                  <Server className="mx-auto size-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">
                    {t("noClusters")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground/70">
                    {t("noClustersHint", { path: kubeconfigPath })}
                  </p>
                </CardContent>
              </Card>
            ) : filteredClusters.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchX className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>{t("noSearchResults")}</EmptyTitle>
                  <EmptyDescription>
                    {t("noSearchResultsHint", { query: searchQuery })}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredClusters.map((cluster) => {
                  const isActive =
                    isConnected && currentCluster?.context === cluster.context;
                  return (
                    <Card
                      key={cluster.id}
                      className={`flex h-full flex-col transition-all ${
                        isActive
                          ? "border-green-500/50 bg-green-500/5"
                          : "hover:border-border/80 hover:bg-muted/50"
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <ClusterIcon cluster={cluster} size={32} />
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                {cluster.name}
                                {cluster.current && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {t("default")}
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {cluster.context}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {currentCluster?.context === cluster.context &&
                              forwards.length > 0 && (
                                <div className="flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5">
                                  <ArrowRightLeft className="size-3 text-purple-500" />
                                  <span className="text-xs font-medium text-purple-500">
                                    {forwards.length}
                                  </span>
                                </div>
                              )}
                            {isActive && (
                              <CheckCircle2 className="size-5 text-green-500" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col space-y-3">
                        <div className="text-sm text-muted-foreground">
                          <p className="truncate">{cluster.server}</p>
                          <p className="text-xs text-muted-foreground/70">
                            {cluster.namespace || "default"} |{" "}
                            {cluster.auth_type}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleConnect(cluster.context)}
                          disabled={connectingContext !== null || isActive}
                          className="mt-auto w-full"
                          variant={isActive ? "secondary" : "default"}
                        >
                          {connectingContext === cluster.context ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : isActive ? (
                            t("connected")
                          ) : (
                            t("connect")
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Welcome Section */}
        {(!isTauri || clusters.length === 0) && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-2xl bg-muted p-6">
                <Server className="size-16 text-primary" />
              </div>
              <h2 className="text-3xl font-bold">{tw("title")}</h2>
              <p className="max-w-md text-muted-foreground">
                {tw("description")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {tw("multiCluster")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {tw("multiClusterDesc")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tw("realTime")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {tw("realTimeDesc")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {tw("resourceMgmt")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {tw("resourceMgmtDesc")}
                  </p>
                </CardContent>
              </Card>
            </div>

            {!isTauri && (
              <Alert className="max-w-md">
                <AlertCircle className="size-4" />
                <AlertDescription>{tw("webModeWarning")}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3 text-center text-xs text-muted-foreground">
        {tw("footer", { version: packageJson.version })}
      </footer>

      {/* Settings Panel */}
      <SettingsPanel />

      {/* Restart Dialog */}
      <RestartDialog />
    </div>
  );
}
