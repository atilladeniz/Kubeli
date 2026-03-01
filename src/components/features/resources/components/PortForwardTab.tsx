"use client";

import { ArrowRightLeft, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useServices } from "@/lib/hooks/useK8sResources";
import { usePortForward } from "@/lib/hooks/usePortForward";
import type { ServiceInfo, ServicePortInfo, PortForwardInfo } from "@/lib/types";

interface PortForwardTabProps {
  resourceName: string;
  resourceNamespace: string;
  resourceType: string;
  resourceLabels?: Record<string, string>;
}

function getForwardForPort(
  forwards: PortForwardInfo[],
  port: ServicePortInfo
): PortForwardInfo | undefined {
  return forwards.find((f) => f.target_port === port.port);
}

function findServicesForPod(
  services: ServiceInfo[],
  namespace: string,
  labels: Record<string, string>
): ServiceInfo[] {
  return services.filter((svc) => {
    if (svc.namespace !== namespace) return false;
    if (!svc.selector || Object.keys(svc.selector).length === 0) return false;
    if (svc.ports.length === 0) return false;
    return Object.entries(svc.selector).every(
      ([key, value]) => labels[key] === value
    );
  });
}

export function PortForwardTab({
  resourceName,
  resourceNamespace,
  resourceType,
  resourceLabels,
}: PortForwardTabProps) {
  const t = useTranslations();
  const { data: services } = useServices({ autoRefresh: true, refreshInterval: 30000 });
  const { forwards, startForward, stopForward } = usePortForward();

  // Find matching service(s)
  let displayServices: ServiceInfo[] = [];
  if (resourceType === "service") {
    const svc = services.find(
      (s) => s.name === resourceName && s.namespace === resourceNamespace
    );
    if (svc && svc.ports.length > 0) displayServices = [svc];
  } else if (resourceType === "pod" && resourceLabels) {
    displayServices = findServicesForPod(services, resourceNamespace, resourceLabels);
  }

  const getServiceForwards = (svcName: string, svcNamespace: string) => {
    return forwards.filter(
      (f) =>
        f.name === svcName &&
        f.namespace === svcNamespace &&
        f.target_type === "service"
    );
  };

  if (displayServices.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 text-center text-muted-foreground text-sm">
          {t("resourceDetail.noPortsAvailable")}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {displayServices.map((svc) => {
          const svcForwards = getServiceForwards(svc.name, svc.namespace);

          return (
            <div key={svc.uid}>
              {resourceType === "pod" && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Service
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {svc.name}
                  </Badge>
                </div>
              )}
              <div className="space-y-2">
                {svc.ports.map((port) => {
                  const forward = getForwardForPort(svcForwards, port);
                  const isForwarded = !!forward;

                  return (
                    <div
                      key={`${port.port}-${port.protocol}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
                        isForwarded
                          ? "border-purple-500/30 bg-purple-500/5"
                          : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-mono text-xs px-2 py-0.5 shrink-0",
                            isForwarded && "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          )}
                        >
                          {port.port}
                        </Badge>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {port.name || `Port ${port.port}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {port.port} &rarr; {port.target_port}/{port.protocol}
                            {isForwarded && forward && (
                              <span className="text-purple-400 ml-2">
                                localhost:{forward.local_port}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant={isForwarded ? "outline" : "default"}
                        size="sm"
                        className={cn(
                          "shrink-0",
                          isForwarded
                            ? "text-red-500 border-red-500/30 hover:bg-red-500/10"
                            : "bg-purple-600 hover:bg-purple-700 text-white"
                        )}
                        onClick={() => {
                          if (isForwarded) {
                            stopForward(forward.forward_id);
                          } else {
                            startForward(svc.namespace, svc.name, "service", port.port);
                          }
                        }}
                      >
                        {isForwarded ? (
                          <>
                            <Square className="size-3.5 mr-1.5" />
                            Stop
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="size-3.5 mr-1.5" />
                            Forward
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
