import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, ArrowRight, Loader2, ChevronDown, Check } from "lucide-react";
import { listPods, listServices } from "@/lib/tauri/commands";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { PodInfo, ServiceInfo } from "@/lib/types";

interface ForwardableItem {
  name: string;
  namespace: string;
  port: number;
  targetType: "pod" | "service";
  portName?: string;
}

export function ForwardTab() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ForwardableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  const [nsOpen, setNsOpen] = useState(false);
  const startForward = usePortForwardStore((s) => s.startForward);
  const forwards = usePortForwardStore((s) => s.forwards);
  const namespaces = useClusterStore((s) => s.namespaces);
  const selectedNamespaces = useClusterStore((s) => s.selectedNamespaces);
  const toggleNamespace = useClusterStore((s) => s.toggleNamespace);
  const selectAllNamespaces = useClusterStore((s) => s.selectAllNamespaces);

  // Close namespace dropdown when tray loses focus / gets dismissed
  useEffect(() => {
    const handleBlur = () => setNsOpen(false);
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  const nsLabel = useMemo(() => {
    if (selectedNamespaces.length === 0) return "All Namespaces";
    if (selectedNamespaces.length === 1) return selectedNamespaces[0];
    return `${selectedNamespaces.length} namespaces`;
  }, [selectedNamespaces]);

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pods, services] = await Promise.all([
        listPods().catch(() => [] as PodInfo[]),
        listServices().catch(() => [] as ServiceInfo[]),
      ]);

      const forwardable: ForwardableItem[] = [];

      for (const pod of pods) {
        if (pod.phase !== "Running") continue;
        for (const container of pod.containers) {
          for (const port of container.ports || []) {
            forwardable.push({
              name: pod.name,
              namespace: pod.namespace,
              port: port.container_port,
              targetType: "pod",
              portName: port.name ?? undefined,
            });
          }
        }
      }

      for (const svc of services) {
        for (const port of svc.ports) {
          forwardable.push({
            name: svc.name,
            namespace: svc.namespace,
            port: port.port,
            targetType: "service",
            portName: port.name ?? undefined,
          });
        }
      }

      setItems(forwardable);
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Refetch when namespace selection changes
  useEffect(() => {
    if (!isLoading) {
      fetchResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNamespaces]);

  const filtered = useMemo(() => {
    let result = items;

    if (selectedNamespaces.length > 0) {
      result = result.filter((item) =>
        selectedNamespaces.includes(item.namespace)
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.namespace.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, search, selectedNamespaces]);

  const grouped = useMemo(() => {
    const map = new Map<string, ForwardableItem[]>();
    for (const item of filtered) {
      const existing = map.get(item.namespace) || [];
      existing.push(item);
      map.set(item.namespace, existing);
    }
    return map;
  }, [filtered]);

  const isAlreadyForwarded = (item: ForwardableItem) => {
    return forwards.some(
      (f) =>
        f.name === item.name &&
        f.namespace === item.namespace &&
        f.target_port === item.port
    );
  };

  const handleForward = async (item: ForwardableItem) => {
    const itemId = `${item.targetType}-${item.namespace}-${item.name}-${item.port}`;
    setForwardingId(itemId);
    try {
      await startForward(
        item.namespace,
        item.name,
        item.targetType,
        item.port
      );
    } finally {
      setForwardingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Namespace selector + Search */}
      <div className="px-3 pb-2 space-y-1.5 shrink-0">
        {/* Namespace dropdown */}
        <div className="relative">
          <button
            onClick={() => setNsOpen(!nsOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] bg-white/[0.04] hover:bg-white/[0.06] rounded-md text-foreground transition-colors"
          >
            <span className="truncate text-foreground">{nsLabel}</span>
            <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 ml-1 transition-transform ${nsOpen ? "rotate-180" : ""}`} />
          </button>
          {nsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNsOpen(false)} />
              <div
                className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg shadow-xl max-h-48 overflow-y-auto overscroll-none border border-white/[0.1]"
                style={{ backgroundColor: "#2a2a2a" }}
              >
                <button
                  onClick={() => { selectAllNamespaces(); setNsOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] transition-colors hover:brightness-125"
                  style={{ backgroundColor: selectedNamespaces.length === 0 ? "#333" : "transparent" }}
                >
                  <div className={`h-3 w-3 rounded-sm border flex items-center justify-center shrink-0 ${selectedNamespaces.length === 0 ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                    {selectedNamespaces.length === 0 && <Check className="h-2 w-2 text-primary-foreground" />}
                  </div>
                  <span className="text-foreground">All Namespaces</span>
                </button>
                {namespaces.map((ns) => {
                  const selected = selectedNamespaces.includes(ns);
                  return (
                    <button
                      key={ns}
                      onClick={() => toggleNamespace(ns)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] transition-colors hover:brightness-125"
                      style={{ backgroundColor: selected ? "#333" : "transparent" }}
                    >
                      <div className={`h-3 w-3 rounded-sm border flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                        {selected && <Check className="h-2 w-2 text-primary-foreground" />}
                      </div>
                      <span className="text-foreground truncate">{ns}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-form-type="other"
            className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-white/[0.04] rounded-md text-foreground placeholder:text-muted-foreground/60 border-0 outline-none focus:bg-white/[0.06] transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-none px-3 pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[11px] text-muted-foreground/60">
            {search ? "No matches found" : "No resources with ports found"}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([namespace, nsItems]) => (
            <div key={namespace} className="mb-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium px-1 py-1">
                {namespace}
              </div>
              {nsItems.map((item, idx) => {
                const itemId = `${item.targetType}-${item.namespace}-${item.name}-${item.port}`;
                const forwarded = isAlreadyForwarded(item);
                const isForwarding = forwardingId === itemId;

                return (
                  <div
                    key={`${item.name}-${item.port}-${idx}`}
                    className="flex items-center justify-between px-1.5 py-1.5 rounded-md hover:bg-white/[0.04] group transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-foreground truncate leading-tight">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">
                        :{item.port}
                        {item.portName ? ` (${item.portName})` : ""}
                        <span className="ml-1 opacity-60">{item.targetType}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleForward(item)}
                      disabled={forwarded || isForwarding}
                      className={`p-1 rounded-md transition-all shrink-0 ${
                        forwarded
                          ? "text-green-500/70"
                          : isForwarding
                            ? "text-muted-foreground"
                            : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100"
                      }`}
                      title={forwarded ? "Already forwarded" : "Start forward"}
                    >
                      {isForwarding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : forwarded ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
