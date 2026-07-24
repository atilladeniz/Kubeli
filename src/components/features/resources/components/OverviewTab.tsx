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
import { OwnerReferencesSection } from "./OwnerReferencesSection";
import { PodSchedulingSection } from "./PodSchedulingSection";
import { getPod } from "@/lib/tauri/commands";
import type { ResourceData } from "../types";
import type { ContainerInfo, TolerationInfo } from "@/lib/types";

function formatDate(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const resolvedLocale = locale === "system" ? undefined : locale;
  return date.toLocaleString(resolvedLocale);
}

interface OverviewTabProps {
  resource: ResourceData;
  resourceType: string;
  onNavigateToOwner?: (kind: string, name: string, namespace?: string) => void;
}

export function OverviewTab({ resource, resourceType, onNavigateToOwner }: OverviewTabProps) {
  const t = useTranslations();
  const locale = useLocale();
  const resourceKey = `${resourceType}-${resource.name}-${resource.namespace}`;

  const [containerData, setContainerData] = useState<{
    key: string;
    initContainers: ContainerInfo[];
    containers: ContainerInfo[];
    serviceAccount: string | null;
    nodeSelector: Record<string, string>;
    tolerations: TolerationInfo[];
  }>({
    key: "",
    initContainers: [],
    containers: [],
    serviceAccount: null,
    nodeSelector: {},
    tolerations: [],
  });

  const fetchContainers = useCallback(async (name: string, namespace: string, key: string) => {
    try {
      const podInfo = await getPod(name, namespace);
      return {
        key,
        initContainers: podInfo.init_containers,
        containers: podInfo.containers,
        serviceAccount: podInfo.service_account,
        nodeSelector: podInfo.node_selector,
        tolerations: podInfo.tolerations,
      };
    } catch (err) {
      console.error("Failed to load pod containers:", err);
      return {
        key,
        initContainers: [] as ContainerInfo[],
        containers: [] as ContainerInfo[],
        serviceAccount: null,
        nodeSelector: {} as Record<string, string>,
        tolerations: [] as TolerationInfo[],
      };
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

  // Only show pod details if they match the current resource (prevents stale data)
  const podDataCurrent = containerData.key === resourceKey;
  const initContainers = podDataCurrent ? containerData.initContainers : [];
  const containers = podDataCurrent ? containerData.containers : [];
  const serviceAccount = podDataCurrent ? containerData.serviceAccount : null;
  const nodeSelector = podDataCurrent ? containerData.nodeSelector : {};
  const tolerations = podDataCurrent ? containerData.tolerations : [];

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

        {/* Owner References Section */}
        {resource.ownerReferences && resource.ownerReferences.length > 0 && onNavigateToOwner && (
          <OwnerReferencesSection
            ownerReferences={resource.ownerReferences}
            onNavigate={onNavigateToOwner}
            namespace={resource.namespace}
          />
        )}

        {/* Scheduling Section (for Pods only) */}
        {resourceType === "pod" && (
          <PodSchedulingSection
            serviceAccount={serviceAccount}
            nodeSelector={nodeSelector}
            tolerations={tolerations}
            namespace={resource.namespace}
            onNavigate={onNavigateToOwner}
          />
        )}

        {/* Pod Metrics Section */}
        {resourceType === "pod" && resource.namespace && (
          <PodMetricsSection podName={resource.name} namespace={resource.namespace} />
        )}

        {/* Container Status Section (for Pods only) */}
        {resourceType === "pod" && (initContainers.length > 0 || containers.length > 0) && (
          <ContainerStatusSection
            initContainers={initContainers}
            containers={containers}
            namespace={resource.namespace ?? ""}
          />
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

