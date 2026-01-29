import type {
  PVInfo,
  PVCInfo,
  StorageClassInfo,
  CSIDriverInfo,
  CSINodeInfo,
  VolumeAttachmentInfo,
} from "@/lib/types";
import type { Column } from "../types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NamespaceColorDot } from "../components/NamespaceColorDot";
import { PVStatusBadge } from "../components/badges/PVStatusBadge";
import { PVCStatusBadge } from "../components/badges/PVCStatusBadge";
import { VolumeAttachmentStatusBadge } from "../components/badges/VolumeAttachmentStatusBadge";
import { formatAge } from "../lib/utils";

export const pvColumns: Column<PVInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (pv) => <span className="font-medium">{pv.name}</span>,
  },
  {
    key: "capacity",
    label: "CAPACITY",
    sortable: true,
    render: (pv) => pv.capacity || "-",
  },
  {
    key: "access_modes",
    label: "ACCESS MODES",
    sortable: false,
    render: (pv) => pv.access_modes.join(", ") || "-",
  },
  {
    key: "reclaim_policy",
    label: "RECLAIM POLICY",
    sortable: true,
    render: (pv) => pv.reclaim_policy || "-",
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (pv) => <PVStatusBadge status={pv.status} />,
  },
  {
    key: "claim",
    label: "CLAIM",
    sortable: true,
    render: (pv) => pv.claim_name ? `${pv.claim_namespace}/${pv.claim_name}` : "-",
  },
  {
    key: "storage_class_name",
    label: "STORAGE CLASS",
    sortable: true,
    render: (pv) => pv.storage_class_name || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (pv) => (pv.created_at ? formatAge(pv.created_at) : "-"),
  },
];

export const pvcColumns: Column<PVCInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (pvc) => <span className="font-medium">{pvc.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (pvc) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={pvc.namespace} />
        <span>{pvc.namespace}</span>
      </div>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (pvc) => <PVCStatusBadge status={pvc.status} />,
  },
  {
    key: "volume_name",
    label: "VOLUME",
    sortable: true,
    render: (pvc) => pvc.volume_name || "-",
  },
  {
    key: "capacity",
    label: "CAPACITY",
    sortable: true,
    render: (pvc) => pvc.capacity || pvc.requested_storage || "-",
  },
  {
    key: "access_modes",
    label: "ACCESS MODES",
    sortable: false,
    render: (pvc) => pvc.access_modes.join(", ") || "-",
  },
  {
    key: "storage_class_name",
    label: "STORAGE CLASS",
    sortable: true,
    render: (pvc) => pvc.storage_class_name || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (pvc) => (pvc.created_at ? formatAge(pvc.created_at) : "-"),
  },
];

export const storageClassColumns: Column<StorageClassInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (sc) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{sc.name}</span>
        {sc.is_default && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/20">
            default
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "provisioner",
    label: "PROVISIONER",
    sortable: true,
    render: (sc) => <span className="text-muted-foreground text-xs font-mono">{sc.provisioner}</span>,
  },
  {
    key: "reclaim_policy",
    label: "RECLAIM POLICY",
    sortable: true,
    render: (sc) => sc.reclaim_policy || "Delete",
  },
  {
    key: "volume_binding_mode",
    label: "VOLUME BINDING MODE",
    sortable: true,
    render: (sc) => sc.volume_binding_mode || "Immediate",
  },
  {
    key: "allow_volume_expansion",
    label: "EXPANSION",
    sortable: true,
    render: (sc) => sc.allow_volume_expansion ? "Yes" : "No",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (sc) => (sc.created_at ? formatAge(sc.created_at) : "-"),
  },
];

export const csiDriverColumns: Column<CSIDriverInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (driver) => <span className="font-medium font-mono text-xs">{driver.name}</span>,
  },
  {
    key: "attach_required",
    label: "ATTACH REQUIRED",
    sortable: true,
    render: (driver) => driver.attach_required ? "Yes" : "No",
  },
  {
    key: "pod_info_on_mount",
    label: "POD INFO",
    sortable: true,
    render: (driver) => driver.pod_info_on_mount ? "Yes" : "No",
  },
  {
    key: "storage_capacity",
    label: "STORAGE CAPACITY",
    sortable: true,
    render: (driver) => driver.storage_capacity ? "Yes" : "No",
  },
  {
    key: "volume_lifecycle_modes",
    label: "MODES",
    sortable: false,
    render: (driver) => driver.volume_lifecycle_modes.join(", ") || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (driver) => (driver.created_at ? formatAge(driver.created_at) : "-"),
  },
];

export const csiNodeColumns: Column<CSINodeInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (node) => <span className="font-medium">{node.name}</span>,
  },
  {
    key: "drivers",
    label: "DRIVERS",
    sortable: true,
    render: (node) => node.drivers.length,
  },
  {
    key: "driver_names",
    label: "DRIVER NAMES",
    sortable: false,
    render: (node) => (
      <div className="flex flex-wrap gap-1">
        {node.drivers.slice(0, 3).map((d) => (
          <Badge key={d.name} variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">
            {d.name.split(".").pop()}
          </Badge>
        ))}
        {node.drivers.length > 3 && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            +{node.drivers.length - 3}
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (node) => (node.created_at ? formatAge(node.created_at) : "-"),
  },
];

export const volumeAttachmentColumns: Column<VolumeAttachmentInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (va) => <span className="font-medium text-xs font-mono">{va.name.slice(0, 40)}...</span>,
  },
  {
    key: "attacher",
    label: "ATTACHER",
    sortable: true,
    render: (va) => <span className="text-xs font-mono">{va.attacher}</span>,
  },
  {
    key: "pv_name",
    label: "PV",
    sortable: true,
    render: (va) => va.pv_name || "-",
  },
  {
    key: "node_name",
    label: "NODE",
    sortable: true,
    render: (va) => va.node_name,
  },
  {
    key: "attached",
    label: "ATTACHED",
    sortable: true,
    render: (va) => <VolumeAttachmentStatusBadge attached={va.attached} />,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (va) => (va.created_at ? formatAge(va.created_at) : "-"),
  },
];
