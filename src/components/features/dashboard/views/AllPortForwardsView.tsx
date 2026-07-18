"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { ActiveRow, HistoryRow, FilterPill } from "./PortForwardRows";
import { mergePortForwardRows } from "./mergePortForwardRows";

type StatusFilter = "all" | "active" | "stopped";

export function AllPortForwardsView() {
  const t = useTranslations("portForward");
  const tc = useTranslations("common");
  const { forwards, stopForward } = usePortForward();
  const [stopDialog, setStopDialog] = useState<{ forwardId: string; name: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<
    | { kind: "active"; forwardId: string; name: string }
    | { kind: "history"; itemId: string; name: string }
    | null
  >(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const history = usePortForwardStore((s) => s.history);
  const removeHistoryItem = usePortForwardStore((s) => s.removeHistoryItem);
  const restartFromHistory = usePortForwardStore((s) => s.restartFromHistory);
  const clusters = useClusterStore((s) => s.clusters);

  // context -> friendly name (fall back to the raw context if unknown)
  const clusterLabel = useMemo(() => {
    const map = new Map(clusters.map((c) => [c.context, c.name || c.context]));
    return (context: string) => map.get(context) ?? context;
  }, [clusters]);

  // Merge active forwards + stopped history across ALL clusters.
  const rows = useMemo(() => mergePortForwardRows(forwards, history), [forwards, history]);

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    if (deleteDialog.kind === "active") {
      const histItem = history.find((h) => h.forward_id === deleteDialog.forwardId);
      const stopped = await stopForward(deleteDialog.forwardId);
      if (stopped && histItem) removeHistoryItem(histItem.id);
    } else {
      removeHistoryItem(deleteDialog.itemId);
    }
    setDeleteDialog(null);
  };

  const confirmStop = async () => {
    if (!stopDialog) return;
    const stopped = await stopForward(stopDialog.forwardId);
    setStopDialog(null);
    if (!stopped) toast.error(t("stopFailed"));
  };

  const activeCount = rows.filter((r) => r.kind === "active").length;
  const historyCount = rows.filter((r) => r.kind === "history").length;

  const visibleRows = useMemo(() => {
    if (filter === "active") return rows.filter((r) => r.kind === "active");
    if (filter === "stopped") return rows.filter((r) => r.kind === "history");
    return rows;
  }, [rows, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-h-8 items-center gap-3 flex-wrap">
          <h1 className="text-lg font-semibold">{t("titleAll")}</h1>
          <div className="flex items-center gap-1 flex-wrap">
            <FilterPill
              label={tc("all")}
              count={rows.length}
              isActive={filter === "all"}
              onClick={() => setFilter("all")}
              color="default"
            />
            <FilterPill
              label={t("active")}
              count={activeCount}
              isActive={filter === "active"}
              onClick={() => setFilter("active")}
              color="green"
            />
            <FilterPill
              label={t("stopped")}
              count={historyCount}
              isActive={filter === "stopped"}
              onClick={() => setFilter("stopped")}
              color="default"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {visibleRows.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowRightLeft />
              </EmptyMedia>
              <EmptyTitle>{t("noForwards")}</EmptyTitle>
              <EmptyDescription>{t("noForwardsHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-14 bg-background text-xs font-medium tracking-wider">{tc("status")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{t("columnCluster")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{tc("name")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{t("columnNamespace")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{t("columnKind")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{t("columnPorts")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider text-right">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) =>
                row.kind === "active" ? (
                  <ActiveRow
                    key={row.forward.forward_id}
                    forward={row.forward}
                    clusterLabel={row.cluster ? clusterLabel(row.cluster) : "—"}
                    onStop={() => setStopDialog({ forwardId: row.forward.forward_id, name: row.forward.name })}
                    onDelete={() => setDeleteDialog({ kind: "active", forwardId: row.forward.forward_id, name: row.forward.name })}
                  />
                ) : (
                  <HistoryRow
                    key={row.item.id}
                    item={row.item}
                    clusterLabel={clusterLabel(row.cluster)}
                    onRestart={() => restartFromHistory(row.item)}
                    onDelete={() => setDeleteDialog({ kind: "history", itemId: row.item.id, name: row.item.name })}
                  />
                )
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!stopDialog} onOpenChange={(open) => !open && setStopDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("stopConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("stopConfirmDesc", { name: stopDialog?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("stop")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDesc", { name: deleteDialog?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
