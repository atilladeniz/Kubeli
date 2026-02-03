"use client";

import { useEffect, useState } from "react";
import { Info, Tag, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslations } from "next-intl";
import { MetadataItem } from "./MetadataItem";
import { SecretDataSection } from "./SecretDataSection";
import { ContainerStatusSection } from "./ContainerStatusSection";
import { getPod } from "@/lib/tauri/commands";
import type { ResourceData } from "../types";
import type { ContainerInfo } from "@/lib/types";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

interface OverviewTabProps {
  resource: ResourceData;
  resourceType: string;
}

export function OverviewTab({ resource, resourceType }: OverviewTabProps) {
  const t = useTranslations();
  const [initContainers, setInitContainers] = useState<ContainerInfo[]>([]);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);

  useEffect(() => {
    if (resourceType === "pod" && resource.namespace) {
      getPod(resource.name, resource.namespace)
        .then((podInfo) => {
          setInitContainers(podInfo.init_containers);
          setContainers(podInfo.containers);
        })
        .catch((err) => console.error("Failed to load pod containers:", err));
    }
  }, [resourceType, resource.name, resource.namespace]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Metadata Section */}
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Info className="size-4" />
            {t("resourceDetail.metadata")}
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <MetadataItem label={t("common.name")} value={resource.name} />
            {resource.namespace && (
              <MetadataItem
                label={t("cluster.namespace")}
                value={resource.namespace}
              />
            )}
            <MetadataItem label="UID" value={resource.uid} mono />
            {resource.createdAt && (
              <MetadataItem
                label={t("common.age")}
                value={formatDate(resource.createdAt)}
              />
            )}
            {resource.apiVersion && (
              <MetadataItem
                label="API Version"
                value={resource.apiVersion}
              />
            )}
            {resource.kind && (
              <MetadataItem label={t("common.type")} value={resource.kind} />
            )}
          </div>
        </section>

        {/* Container Status Section (for Pods only) */}
        {resourceType === "pod" && (initContainers.length > 0 || containers.length > 0) && (
          <ContainerStatusSection initContainers={initContainers} containers={containers} />
        )}

        {/* Labels Section */}
        {resource.labels && Object.keys(resource.labels).length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Tag className="size-4" />
              {t("common.labels")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(resource.labels).map(([key, value]) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="font-mono text-xs"
                >
                  {key}={value}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Annotations Section */}
        {resource.annotations &&
          Object.keys(resource.annotations).length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-3">{t("common.annotations")}</h3>
              <div className="space-y-2">
                {Object.entries(resource.annotations).map(
                  ([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="font-mono text-muted-foreground">
                        {key}
                      </span>
                      <p className="mt-0.5 break-all">{value}</p>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

        {/* Status Section */}
        {resource.status && Object.keys(resource.status).length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="size-4" />
              {t("common.status")}
            </h3>
            <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto">
              {JSON.stringify(resource.status, null, 2)}
            </pre>
          </section>
        )}

        {/* Spec Section */}
        {resource.spec && Object.keys(resource.spec).length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3">{t("resourceDetail.spec")}</h3>
            <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto">
              {JSON.stringify(resource.spec, null, 2)}
            </pre>
          </section>
        )}

        {/* Secret Data Section */}
        {resourceType === "secret" && resource.yaml && (
          <SecretDataSection yaml={resource.yaml} />
        )}
      </div>
    </ScrollArea>
  );
}
