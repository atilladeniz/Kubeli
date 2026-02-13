"use client";

import { useEffect, useState, useCallback } from "react";

import { Info, Tag, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/providers/I18nProvider";
import { MetadataItem } from "./MetadataItem";
import { SecretDataSection } from "./SecretDataSection";
import { ContainerStatusSection } from "./ContainerStatusSection";
import { PodMetricsSection } from "./PodMetricsSection";
import { AnnotationsSection } from "./AnnotationsSection";
import { getPod } from "@/lib/tauri/commands";
import type { ResourceData } from "../types";
import type { ContainerInfo } from "@/lib/types";

function formatDate(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const resolvedLocale = locale === "system" ? undefined : locale;
  return date.toLocaleString(resolvedLocale);
}

interface OverviewTabProps {
  resource: ResourceData;
  resourceType: string;
}

export function OverviewTab({ resource, resourceType }: OverviewTabProps) {
  const t = useTranslations();
  const locale = useLocale();
  const resourceKey = `${resourceType}-${resource.name}-${resource.namespace}`;

  const [containerData, setContainerData] = useState<{
    key: string;
    initContainers: ContainerInfo[];
    containers: ContainerInfo[];
  }>({ key: "", initContainers: [], containers: [] });

  const fetchContainers = useCallback(async (name: string, namespace: string, key: string) => {
    try {
      const podInfo = await getPod(name, namespace);
      return { key, initContainers: podInfo.init_containers, containers: podInfo.containers };
    } catch (err) {
      console.error("Failed to load pod containers:", err);
      return { key, initContainers: [] as ContainerInfo[], containers: [] as ContainerInfo[] };
    }
  }, []);

  useEffect(() => {
    if (resourceType !== "pod" || !resource.namespace) {
      return;
    }

    let cancelled = false;

    fetchContainers(resource.name, resource.namespace, resourceKey).then((data) => {
      if (!cancelled) {
        setContainerData(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resourceType, resource.name, resource.namespace, resourceKey, fetchContainers]);

  // Only show containers if they match the current resource (prevents stale data)
  const initContainers = containerData.key === resourceKey ? containerData.initContainers : [];
  const containers = containerData.key === resourceKey ? containerData.containers : [];

  return (
    <div className="h-full overflow-y-auto">
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
                value={formatDate(resource.createdAt, locale)}
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

        {/* Pod Metrics Section */}
        {resourceType === "pod" && resource.namespace && (
          <PodMetricsSection podName={resource.name} namespace={resource.namespace} />
        )}

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
            <div className="flex flex-wrap gap-2 min-w-0">
              {Object.entries(resource.labels).map(([key, value]) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="font-mono text-xs max-w-full min-w-0"
                  title={`${key}=${value}`}
                >
                  <span className="truncate">{key}={value}</span>
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Annotations Section */}
        {resource.annotations &&
          Object.keys(resource.annotations).length > 0 && (
            <AnnotationsSection
              annotations={resource.annotations}
              label={t("common.annotations")}
              copyToastMessage={t("messages.copySuccess")}
            />
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
    </div>
  );
}

