import { useTranslations } from "next-intl";
import { CheckCircle2, ArrowRightLeft, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ClusterIcon } from "@/components/ui/cluster-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClusterCardProps } from "./cluster-card-types";

export function ClusterGridCard({
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
    <Card
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
                  <Badge variant="secondary" className="text-[10px]">
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
            {forwardsCount > 0 && (
              <div className="flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5">
                <ArrowRightLeft className="size-3 text-purple-500" />
                <span className="text-xs font-medium text-purple-500">
                  {forwardsCount}
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
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <span>{cluster.namespace || "default"} | {cluster.auth_type}</span>
            {hasConfiguredNamespaces && (
              <Badge variant="outline" className="px-1 py-0 text-[9px] font-normal">
                NS
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2 mt-auto">
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 size-9"
          onClick={() => onConfigureNamespaces(cluster.context)}
          title={t("configureNamespaces")}
        >
          <Settings2 className="size-4" />
        </Button>
        <Button
          onClick={() => onConnect(cluster.context)}
          disabled={disabled}
          className="flex-1"
          variant={isActive ? "secondary" : "default"}
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
      </CardContent>
    </Card>
  );
}
