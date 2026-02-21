import { useTranslations } from "next-intl";
import { CheckCircle2, ArrowRightLeft, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ClusterIcon } from "@/components/ui/cluster-icon";
import type { ClusterCardProps } from "./cluster-card-types";

export function ClusterListCard({
  cluster,
  isActive,
  isConnecting,
  disabled,
  onConnect,
  onConfigureNamespaces,
  forwardsCount,
  hasConfiguredNamespaces,
}: ClusterCardProps) {
  const t = useTranslations("cluster");

  return (
    <div
      className={`flex items-center gap-3 border-b border-border/50 px-3 py-2.5 transition-colors ${
        isActive
          ? "bg-green-500/5"
          : "hover:bg-muted/50"
      }`}
    >
      <ClusterIcon cluster={cluster} size={22} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">
            {cluster.name}
          </span>
          {cluster.current && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {t("default")}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {cluster.context}
        </p>
        <p className="truncate text-[11px] text-muted-foreground/50">
          {cluster.server}
        </p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground/70 md:flex">
        {cluster.namespace || "default"}
        {hasConfiguredNamespaces && (
          <Badge variant="outline" className="px-1 py-0 text-[9px] font-normal">
            NS
          </Badge>
        )}
      </span>
      <span className="hidden shrink-0 text-xs text-muted-foreground/70 sm:block">
        {cluster.auth_type}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        {forwardsCount > 0 && (
          <div className="flex items-center gap-0.5 rounded bg-purple-500/10 px-1.5 py-0.5">
            <ArrowRightLeft className="size-3 text-purple-500" />
            <span className="text-xs font-medium text-purple-500">
              {forwardsCount}
            </span>
          </div>
        )}
        {isActive && (
          <CheckCircle2 className="size-3.5 text-green-500" />
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => onConfigureNamespaces(cluster.context)}
          title={t("configureNamespaces")}
        >
          <Settings2 className="size-3.5" />
        </Button>
        <Button
          onClick={() => onConnect(cluster.context)}
          disabled={disabled}
          size="sm"
          variant={isActive ? "secondary" : "default"}
          className="h-7 px-3 text-xs"
        >
          {isConnecting ? (
            <>
              <Spinner />
              {t("connecting")}
            </>
          ) : isActive ? (
            t("connected")
          ) : (
            t("connect")
          )}
        </Button>
      </div>
    </div>
  );
}
