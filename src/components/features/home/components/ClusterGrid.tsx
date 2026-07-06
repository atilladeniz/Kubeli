import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Server,
  RefreshCw,
  Search,
  SearchX,
  Settings,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { getClusterSettings } from "@/lib/tauri/commands";
import { ConnectionErrorAlert } from "./ConnectionErrorAlert";
import { ClusterGridCard } from "./ClusterGridCard";
import { ClusterListCard } from "./ClusterListCard";
import { ConfigureNamespacesDialog } from "./ConfigureNamespacesDialog";

export function ClusterGrid() {
  const t = useTranslations("cluster");
  const tc = useTranslations("common");
  const [searchQuery, setSearchQuery] = useState("");
  const [connectingContext, setConnectingContext] = useState<string | null>(
    null,
  );
  const viewLayout = useUIStore((s) => s.settings.clusterViewLayout);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const openSettingsTab = useUIStore((s) => s.openSettingsTab);

  const clusters = useClusterStore((s) => s.clusters);
  const currentCluster = useClusterStore((s) => s.currentCluster);
  const isConnected = useClusterStore((s) => s.isConnected);
  const isLoading = useClusterStore((s) => s.isLoading);
  const hasFetchedClusters = useClusterStore((s) => s.hasFetchedClusters);
  const fetchClusters = useClusterStore((s) => s.fetchClusters);
  const connect = useClusterStore((s) => s.connect);
  const oidcPendingContext = useClusterStore((s) => s.oidcPendingContext);
  const cancelConnect = useClusterStore((s) => s.cancelConnect);
  const saveAccessibleNamespaces = useClusterStore((s) => s.saveAccessibleNamespaces);
  const clearAccessibleNamespaces = useClusterStore((s) => s.clearAccessibleNamespaces);
  const { forwards } = usePortForward();

  // Configure namespaces dialog state
  type NsDialogState = {
    open: boolean;
    context: string;
    existing: string[] | undefined;
    preferAuth: boolean;
    configuredContexts: Set<string>;
  };
  type NsDialogAction =
    | { type: "open"; context: string; existing: string[] | undefined; preferAuth: boolean }
    | { type: "close" }
    | { type: "setOpen"; open: boolean }
    | { type: "addConfigured"; context: string }
    | { type: "removeConfigured"; context: string }
    | { type: "setConfigured"; contexts: Set<string> };

  const [nsDialog, nsDialogDispatch] = useReducer(
    (state: NsDialogState, action: NsDialogAction): NsDialogState => {
      switch (action.type) {
        case "open":
          return {
            ...state,
            open: true,
            context: action.context,
            existing: action.existing,
            preferAuth: action.preferAuth,
          };
        case "close":
          return { ...state, open: false };
        case "setOpen":
          return { ...state, open: action.open };
        case "addConfigured":
          return { ...state, configuredContexts: new Set(state.configuredContexts).add(action.context) };
        case "removeConfigured": {
          const next = new Set(state.configuredContexts);
          next.delete(action.context);
          return { ...state, configuredContexts: next };
        }
        case "setConfigured":
          return { ...state, configuredContexts: action.contexts };
      }
    },
    { open: false, context: "", existing: undefined, preferAuth: false, configuredContexts: new Set<string>() },
  );

  // Load configured contexts on mount and when clusters change
  useEffect(() => {
    let cancelled = false;
    async function loadConfigured() {
      // One call per cluster, all in parallel - sequential awaits made the
      // grid wait clusters x RTT before showing namespace badges
      const results = await Promise.allSettled(
        clusters.map(async (cluster) => {
          const settings = await getClusterSettings(cluster.context);
          return settings && settings.accessible_namespaces.length > 0
            ? cluster.context
            : null;
        }),
      );
      const configured = new Set<string>();
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) configured.add(r.value);
      }
      if (!cancelled) nsDialogDispatch({ type: "setConfigured", contexts: configured });
    }
    if (clusters.length > 0) loadConfigured();
    return () => { cancelled = true; };
  }, [clusters]);

  const handleConfigureNamespaces = useCallback(async (context: string) => {
    let existing: string[] | undefined;
    let preferAuth = false;
    try {
      const settings = await getClusterSettings(context);
      existing = settings?.accessible_namespaces;
      preferAuth = Boolean(settings?.prefer_kubeconfig_auth);
    } catch {
      existing = undefined;
    }
    nsDialogDispatch({ type: "open", context, existing, preferAuth });
  }, []);

  const handleSaveNamespaces = useCallback(async (context: string, namespaces: string[]) => {
    await saveAccessibleNamespaces(context, namespaces);
    nsDialogDispatch({ type: "addConfigured", context });
  }, [saveAccessibleNamespaces]);

  const handleClearNamespaces = useCallback(async (context: string) => {
    await clearAccessibleNamespaces(context);
    nsDialogDispatch({ type: "removeConfigured", context });
  }, [clearAccessibleNamespaces]);

  // The store's hasFetchedClusters flag (set after the first fetch resolves)
  // gates the empty state; deriving it from !isLoading flashed "no clusters
  // found" on cold start, before the initial fetch had even started.

  const searchLower = searchQuery.toLowerCase();
  const filteredClusters = clusters.filter(
    (cluster) =>
      cluster.name.toLowerCase().includes(searchLower) ||
      cluster.context.toLowerCase().includes(searchLower),
  );

  // Monotonic id so a cancelled connect that resolves late can't clobber the UI.
  const connectSeq = useRef(0);

  const handleConnect = async (context: string) => {
    const seq = ++connectSeq.current;
    setConnectingContext(context);
    try {
      await connect(context);
    } finally {
      if (connectSeq.current === seq) setConnectingContext(null);
    }
  };

  const handleCancelConnect = () => {
    connectSeq.current++; // invalidate the in-flight connect
    setConnectingContext(null);
    cancelConnect();
  };

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
      <div className="shrink-0 px-6 pt-2">
        <ConnectionErrorAlert />
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold">{t("selectCluster")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("selectClusterDesc")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchClustersPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8"
            />
            {searchQuery.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 size-6 -translate-y-1/2 rounded"
                onClick={() => setSearchQuery("")}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={viewLayout}
            onValueChange={(v) => {
              if (v)
                updateSettings({
                  clusterViewLayout: v as "grid" | "list",
                });
            }}
          >
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchClusters()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {tc("refresh")}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6">
        {clusters.length === 0 && hasFetchedClusters ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Server className="size-5" />
              </EmptyMedia>
              <EmptyTitle>{t("noClusters")}</EmptyTitle>
              <EmptyDescription>{t("noClustersHint")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSettingsTab("kubeconfig")}
              >
                <Settings className="size-4" />
                {t("noClustersConfigureButton")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : filteredClusters.length === 0 && searchQuery.trim().length > 0 ? (
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
          <div
            className={
              viewLayout === "grid"
                ? "grid gap-3 md:grid-cols-2 lg:grid-cols-3"
                : "overflow-hidden rounded-lg border"
            }
          >
            {filteredClusters.map((cluster) => {
              const isActive =
                isConnected && currentCluster?.context === cluster.context;
              const showForwards =
                currentCluster?.context === cluster.context;
              const cardProps = {
                cluster,
                isActive,
                isConnecting:
                  connectingContext === cluster.context ||
                  oidcPendingContext === cluster.context,
                disabled:
                  connectingContext !== null || oidcPendingContext !== null || isActive,
                onConnect: handleConnect,
                onCancelConnect: handleCancelConnect,
                onConfigureNamespaces: handleConfigureNamespaces,
                forwardsCount: showForwards ? forwards.length : 0,
                hasConfiguredNamespaces: nsDialog.configuredContexts.has(cluster.context),
              };
              return viewLayout === "list" ? (
                <ClusterListCard key={cluster.id} {...cardProps} />
              ) : (
                <ClusterGridCard key={cluster.id} {...cardProps} />
              );
            })}
          </div>
        )}
      </div>

      <ConfigureNamespacesDialog
        open={nsDialog.open}
        onOpenChange={(open) => nsDialogDispatch({ type: "setOpen", open })}
        context={nsDialog.context}
        defaultNamespace={clusters.find((c) => c.context === nsDialog.context)?.namespace}
        existingNamespaces={nsDialog.existing}
        preferKubeconfigAuth={nsDialog.preferAuth}
        onSave={handleSaveNamespaces}
        onClear={handleClearNamespaces}
      />
    </section>
  );
}
