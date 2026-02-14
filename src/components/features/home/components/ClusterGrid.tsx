import { useState } from "react";
import { useTranslations } from "next-intl";
import { Server, RefreshCw, Search, SearchX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { usePlatform } from "@/lib/hooks/usePlatform";
import { ClusterCard } from "./ClusterCard";

export function ClusterGrid() {
  const t = useTranslations("cluster");
  const tc = useTranslations("common");
  const [searchQuery, setSearchQuery] = useState("");
  const [connectingContext, setConnectingContext] = useState<string | null>(
    null,
  );

  const {
    clusters,
    currentCluster,
    isConnected,
    isLoading,
    fetchClusters,
    connect,
  } = useClusterStore();
  const { forwards } = usePortForward();
  const { isWindows } = usePlatform();
  const kubeconfigPath = isWindows
    ? "C:\\Users\\<username>\\.kube\\config"
    : "~/.kube/config";

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

      {clusters.length === 0 && !isLoading ? (
        <Card className="text-center">
          <CardContent className="py-12">
            <Server className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">{t("noClusters")}</p>
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
            const showForwards =
              currentCluster?.context === cluster.context;
            return (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                isActive={isActive}
                isConnecting={connectingContext === cluster.context}
                disabled={connectingContext !== null || isActive}
                onConnect={handleConnect}
                forwardsCount={showForwards ? forwards.length : 0}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
