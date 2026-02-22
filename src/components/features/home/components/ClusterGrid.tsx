import { useCallback, useEffect, useRef, useState } from "react";
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

  const {
    clusters,
    currentCluster,
    isConnected,
    isLoading,
    fetchClusters,
    connect,
    saveAccessibleNamespaces,
    clearAccessibleNamespaces,
  } = useClusterStore();
  const { forwards } = usePortForward();

  // Configure namespaces dialog state
  const [configureNsOpen, setConfigureNsOpen] = useState(false);
  const [configureNsContext, setConfigureNsContext] = useState("");
  const [configureNsExisting, setConfigureNsExisting] = useState<string[] | undefined>();
  // Track which contexts have configured namespaces
  const [configuredContexts, setConfiguredContexts] = useState<Set<string>>(new Set());

  // Load configured contexts on mount and when clusters change
  useEffect(() => {
    let cancelled = false;
    async function loadConfigured() {
      const configured = new Set<string>();
      for (const cluster of clusters) {
        try {
          const settings = await getClusterSettings(cluster.context);
          if (settings && settings.accessible_namespaces.length > 0) {
            configured.add(cluster.context);
          }
        } catch {
          // Ignore errors
        }
      }
      if (!cancelled) setConfiguredContexts(configured);
    }
    if (clusters.length > 0) loadConfigured();
    return () => { cancelled = true; };
  }, [clusters]);

  const handleConfigureNamespaces = useCallback(async (context: string) => {
    try {
      const settings = await getClusterSettings(context);
      setConfigureNsExisting(settings?.accessible_namespaces);
    } catch {
      setConfigureNsExisting(undefined);
    }
    setConfigureNsContext(context);
    setConfigureNsOpen(true);
  }, []);

  const handleSaveNamespaces = useCallback(async (context: string, namespaces: string[]) => {
    await saveAccessibleNamespaces(context, namespaces);
    setConfiguredContexts((prev) => new Set(prev).add(context));
  }, [saveAccessibleNamespaces]);

  const handleClearNamespaces = useCallback(async (context: string) => {
    await clearAccessibleNamespaces(context);
    setConfiguredContexts((prev) => {
      const next = new Set(prev);
      next.delete(context);
      return next;
    });
  }, [clearAccessibleNamespaces]);

  // Track whether the initial fetch has completed to avoid showing
  // the empty state before we know if clusters exist
  const hasFetchedRef = useRef(false);
  if (!isLoading && !hasFetchedRef.current) {
    hasFetchedRef.current = true;
  }

  const searchLower = searchQuery.toLowerCase();
  const filteredClusters = clusters.filter(
    (cluster) =>
      cluster.name.toLowerCase().includes(searchLower) ||
      cluster.context.toLowerCase().includes(searchLower),
  );

  const handleConnect = async (context: string) => {
    setConnectingContext(context);
    try {
      await connect(context);
    } finally {
      setConnectingContext(null);
    }
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
        {clusters.length === 0 && hasFetchedRef.current ? (
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
                isConnecting: connectingContext === cluster.context,
                disabled: connectingContext !== null || isActive,
                onConnect: handleConnect,
                onConfigureNamespaces: handleConfigureNamespaces,
                forwardsCount: showForwards ? forwards.length : 0,
                hasConfiguredNamespaces: configuredContexts.has(cluster.context),
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
        open={configureNsOpen}
        onOpenChange={setConfigureNsOpen}
        context={configureNsContext}
        defaultNamespace={clusters.find((c) => c.context === configureNsContext)?.namespace}
        existingNamespaces={configureNsExisting}
        onSave={handleSaveNamespaces}
        onClear={handleClearNamespaces}
      />
    </section>
  );
}
