"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  detectClusterType,
  getClusterIconPath,
  type ClusterType,
} from "@/lib/utils/cluster-type";
import type { Cluster } from "@/lib/types";

interface ClusterIconProps {
  cluster: Pick<Cluster, "name" | "context" | "server">;
  size?: number;
  className?: string;
}

export function ClusterIcon({ cluster, size = 20, className }: ClusterIconProps) {
  const clusterType = detectClusterType(cluster);
  const iconPath = getClusterIconPath(clusterType);

  return (
    <Image
      src={iconPath}
      alt={clusterType}
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}

interface ClusterIconByTypeProps {
  type: ClusterType;
  size?: number;
  className?: string;
}

export function ClusterIconByType({ type, size = 20, className }: ClusterIconByTypeProps) {
  const iconPath = getClusterIconPath(type);

  return (
    <Image
      src={iconPath}
      alt={type}
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}
