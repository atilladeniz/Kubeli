import ELK, { ElkNode } from "elkjs/lib/elk.bundled.js";
import type { GraphNode, GraphEdge } from "../types";

export interface LayoutRequest {
  type: "layout";
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LayoutResponse {
  type: "complete" | "error";
  positions?: Record<string, { x: number; y: number }>;
  sizes?: Record<string, { width: number; height: number }>;
  error?: string;
}

// Node dimensions for leaf nodes (matching the new card-style design)
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  namespace: { width: 200, height: 60 },
  deployment: { width: 200, height: 60 },
  pod: { width: 200, height: 56 },
};

// Padding inside group nodes
const GROUP_PADDING = {
  deployment: { top: 50, left: 20, right: 20, bottom: 20 },
  namespace: { top: 60, left: 30, right: 30, bottom: 30 },
};

const NAMESPACE_SPACING = 80; // Horizontal space between namespaces

const elk = new ELK();

interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  sizes: Map<string, { width: number; height: number }>;
}

export async function calculateLayout(
  nodes: GraphNode[],
  _edges: GraphEdge[]
): Promise<LayoutResult> {
  const positions = new Map<string, { x: number; y: number }>();
  const sizes = new Map<string, { width: number; height: number }>();

  if (nodes.length === 0) {
    return { positions, sizes };
  }

  // Separate nodes by type
  const namespaces = nodes.filter((n) => n.node_type === "namespace");
  const deployments = nodes.filter((n) => n.node_type === "deployment");
  const pods = nodes.filter((n) => n.node_type === "pod");

  // Build parent-child relationships
  const podsByDeployment = new Map<string, GraphNode[]>();
  const orphanPodsByNamespace = new Map<string, GraphNode[]>();
  const deploymentsByNamespace = new Map<string, GraphNode[]>();

  // Group deployments by namespace
  for (const deploy of deployments) {
    if (deploy.parent_id) {
      const existing = deploymentsByNamespace.get(deploy.parent_id) || [];
      existing.push(deploy);
      deploymentsByNamespace.set(deploy.parent_id, existing);
    }
  }

  // Group pods by deployment or namespace (orphans)
  for (const pod of pods) {
    if (pod.parent_id) {
      // Check if parent is a deployment
      const parentDeploy = deployments.find((d) => d.id === pod.parent_id);
      if (parentDeploy) {
        const existing = podsByDeployment.get(pod.parent_id) || [];
        existing.push(pod);
        podsByDeployment.set(pod.parent_id, existing);
      } else {
        // Parent is namespace (orphan pod)
        const existing = orphanPodsByNamespace.get(pod.parent_id) || [];
        existing.push(pod);
        orphanPodsByNamespace.set(pod.parent_id, existing);
      }
    }
  }

  // Step 1: Calculate deployment sizes based on their pods
  const deploymentSizes = new Map<string, { width: number; height: number }>();

  for (const deploy of deployments) {
    const deployPods = podsByDeployment.get(deploy.id) || [];
    const padding = GROUP_PADDING.deployment;

    if (deployPods.length === 0) {
      // Empty deployment - minimum size
      deploymentSizes.set(deploy.id, { width: 200, height: 80 });
      continue;
    }

    // Create ELK graph for pods inside deployment
    const elkPods: ElkNode[] = deployPods.map((pod) => ({
      id: pod.id,
      width: NODE_DIMENSIONS.pod.width,
      height: NODE_DIMENSIONS.pod.height,
    }));

    const deployGraph: ElkNode = {
      id: `layout-${deploy.id}`,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "20",
        "elk.layered.spacing.nodeNodeBetweenLayers": "30",
      },
      children: elkPods,
      edges: [],
    };

    try {
      const layouted = await elk.layout(deployGraph);

      // Calculate bounds
      let maxX = 0,
        maxY = 0;
      if (layouted.children) {
        for (const child of layouted.children) {
          maxX = Math.max(maxX, (child.x || 0) + (child.width || 0));
          maxY = Math.max(maxY, (child.y || 0) + (child.height || 0));
        }

        // Store pod positions relative to deployment
        for (const child of layouted.children) {
          positions.set(child.id, {
            x: padding.left + (child.x || 0),
            y: padding.top + (child.y || 0),
          });
        }
      }

      const deployWidth = Math.max(200, maxX + padding.left + padding.right);
      const deployHeight = Math.max(80, maxY + padding.top + padding.bottom);
      deploymentSizes.set(deploy.id, { width: deployWidth, height: deployHeight });
    } catch {
      // Fallback: grid layout
      const cols = Math.min(2, deployPods.length);
      const rows = Math.ceil(deployPods.length / cols);

      deployPods.forEach((pod, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.set(pod.id, {
          x: padding.left + col * (NODE_DIMENSIONS.pod.width + 15),
          y: padding.top + row * (NODE_DIMENSIONS.pod.height + 15),
        });
      });

      const deployWidth = padding.left + padding.right + cols * (NODE_DIMENSIONS.pod.width + 15);
      const deployHeight = padding.top + padding.bottom + rows * (NODE_DIMENSIONS.pod.height + 15);
      deploymentSizes.set(deploy.id, { width: deployWidth, height: deployHeight });
    }
  }

  // Step 2: Layout each namespace with deployments and orphan pods
  let currentX = 0;

  for (const ns of namespaces) {
    const nsDeployments = deploymentsByNamespace.get(ns.id) || [];
    const nsOrphanPods = orphanPodsByNamespace.get(ns.id) || [];
    const padding = GROUP_PADDING.namespace;

    positions.set(ns.id, { x: currentX, y: 0 });

    if (nsDeployments.length === 0 && nsOrphanPods.length === 0) {
      // Empty namespace
      sizes.set(ns.id, { width: 250, height: 100 });
      currentX += 250 + NAMESPACE_SPACING;
      continue;
    }

    // Create ELK nodes for deployments (using calculated sizes)
    const elkChildren: ElkNode[] = [];

    for (const deploy of nsDeployments) {
      const deploySize = deploymentSizes.get(deploy.id) || { width: 200, height: 80 };
      elkChildren.push({
        id: deploy.id,
        width: deploySize.width,
        height: deploySize.height,
      });
    }

    // Add orphan pods as direct children
    for (const pod of nsOrphanPods) {
      elkChildren.push({
        id: pod.id,
        width: NODE_DIMENSIONS.pod.width,
        height: NODE_DIMENSIONS.pod.height,
      });
    }

    const nsGraph: ElkNode = {
      id: `layout-${ns.id}`,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "40",
        "elk.layered.spacing.nodeNodeBetweenLayers": "50",
      },
      children: elkChildren,
      edges: [],
    };

    try {
      const layouted = await elk.layout(nsGraph);

      let maxX = 0,
        maxY = 0;
      if (layouted.children) {
        for (const child of layouted.children) {
          maxX = Math.max(maxX, (child.x || 0) + (child.width || 0));
          maxY = Math.max(maxY, (child.y || 0) + (child.height || 0));

          // Set position relative to namespace
          positions.set(child.id, {
            x: padding.left + (child.x || 0),
            y: padding.top + (child.y || 0),
          });

          // Store deployment sizes for React Flow
          const deploy = nsDeployments.find((d) => d.id === child.id);
          if (deploy) {
            const deploySize = deploymentSizes.get(deploy.id);
            if (deploySize) {
              sizes.set(deploy.id, deploySize);
            }
          }
        }
      }

      const nsWidth = Math.max(300, maxX + padding.left + padding.right);
      const nsHeight = Math.max(150, maxY + padding.top + padding.bottom);
      sizes.set(ns.id, { width: nsWidth, height: nsHeight });
      currentX += nsWidth + NAMESPACE_SPACING;
    } catch {
      // Fallback: vertical stack
      let yOffset = padding.top;

      for (const deploy of nsDeployments) {
        const deploySize = deploymentSizes.get(deploy.id) || { width: 200, height: 80 };
        positions.set(deploy.id, { x: padding.left, y: yOffset });
        sizes.set(deploy.id, deploySize);
        yOffset += deploySize.height + 30;
      }

      for (const pod of nsOrphanPods) {
        positions.set(pod.id, { x: padding.left, y: yOffset });
        yOffset += NODE_DIMENSIONS.pod.height + 15;
      }

      const nsWidth = 350;
      const nsHeight = yOffset + padding.bottom;
      sizes.set(ns.id, { width: nsWidth, height: nsHeight });
      currentX += nsWidth + NAMESPACE_SPACING;
    }
  }

  return { positions, sizes };
}

// For use as a Web Worker
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.onmessage = async (event: MessageEvent<LayoutRequest>) => {
    const { type, nodes, edges } = event.data;

    if (type === "layout") {
      try {
        const { positions, sizes } = await calculateLayout(nodes, edges);

        // Convert Maps to objects for postMessage
        const positionsObj: Record<string, { x: number; y: number }> = {};
        positions.forEach((value, key) => {
          positionsObj[key] = value;
        });

        const sizesObj: Record<string, { width: number; height: number }> = {};
        sizes.forEach((value, key) => {
          sizesObj[key] = value;
        });

        self.postMessage({
          type: "complete",
          positions: positionsObj,
          sizes: sizesObj,
        } as LayoutResponse);
      } catch (error) {
        self.postMessage({
          type: "error",
          error: error instanceof Error ? error.message : "Layout failed",
        } as LayoutResponse);
      }
    }
  };
}
