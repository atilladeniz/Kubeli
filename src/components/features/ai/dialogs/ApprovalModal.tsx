"use client";

import { useTranslations } from "next-intl";
import { useAIStore } from "@/lib/stores/ai-store";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, ShieldCheck, ShieldX, Terminal } from "lucide-react";

interface ApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_STYLES = {
  critical: "bg-red-500/20 text-red-400 border-red-500/50",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
} as const;

/**
 * Modal for approving/rejecting AI tool execution requests.
 */
export function ApprovalModal({ open, onOpenChange }: ApprovalModalProps) {
  const t = useTranslations("ai");
  const { pendingApproval, approveAction, rejectAction } = useAIStore();

  if (!pendingApproval) return null;

  const handleApprove = async () => {
    await approveAction(pendingApproval.request_id);
    onOpenChange(false);
  };

  const handleReject = async () => {
    await rejectAction(pendingApproval.request_id, "User rejected the action");
    onOpenChange(false);
  };

  const severityStyle =
    SEVERITY_STYLES[pendingApproval.severity as keyof typeof SEVERITY_STYLES] ||
    "bg-muted text-muted-foreground";

  const isHighRisk =
    pendingApproval.severity === "critical" ||
    pendingApproval.severity === "high";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isHighRisk ? (
              <ShieldX className="h-5 w-5 text-red-400" />
            ) : pendingApproval.severity === "medium" ? (
              <ShieldAlert className="h-5 w-5 text-yellow-400" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            )}
            {t("approvalRequired")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={severityStyle}>
                  {pendingApproval.severity.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {pendingApproval.reason}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Terminal className="h-4 w-4" />
                  {t("tool")}: {pendingApproval.tool_name}
                </div>
                <ScrollArea className="h-[120px] rounded-md border bg-muted/50 p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {pendingApproval.command_preview}
                  </pre>
                </ScrollArea>
              </div>

              <p className="text-sm text-muted-foreground">
                {t("aiTryingAction")}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleReject}>
            {t("deny")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleApprove}
            className={isHighRisk ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {t("approve")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
