"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Trash2, MessageSquare, Clock, ChevronRight, Plus, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";
import {
  aiListSavedSessions,
  aiDeleteSavedSession,
  aiGetConversationHistory,
  type SessionSummary,
  type MessageRecord,
} from "@/lib/tauri/commands";

interface SessionHistoryProps {
  clusterContext: string;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string, messages: MessageRecord[]) => void;
  onNewSession: () => void;
}

export function SessionHistory({
  clusterContext,
  currentSessionId,
  onSelectSession,
  onNewSession,
}: SessionHistoryProps) {
  const t = useTranslations("ai");
  const tc = useTranslations("common");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Load saved sessions for this cluster
  const loadSessions = useCallback(async () => {
    if (!clusterContext) return;

    try {
      setLoading(true);
      const savedSessions = await aiListSavedSessions(clusterContext);
      setSessions(savedSessions);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    } finally {
      setLoading(false);
    }
  }, [clusterContext]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle session selection
  const handleSelectSession = async (session: SessionSummary) => {
    if (session.session_id === currentSessionId) return;

    try {
      setLoadingSession(session.session_id);
      const messages = await aiGetConversationHistory(session.session_id);
      onSelectSession(session.session_id, messages);
    } catch (e) {
      toast.error(t("loadSessionError"));
      console.error("Failed to load session:", e);
    } finally {
      setLoadingSession(null);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  // Handle session deletion
  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      await aiDeleteSavedSession(sessionToDelete);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionToDelete));
      toast.success(t("sessionDeleted"));
    } catch (e) {
      toast.error(t("deleteError"));
      console.error("Failed to delete session:", e);
    } finally {
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("justNow");
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
  };

  // Get session title or fallback
  const getSessionTitle = (session: SessionSummary) => {
    if (session.title) return session.title;
    const date = new Date(session.created_at);
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Inline cursor style (most reliable)
  const pointerStyle = { cursor: "pointer" } as const;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b bg-background/50">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("sessionHistory")}
          </span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  style={pointerStyle}
                  onClick={loadSessions}
                  disabled={loading}
                >
                  <RotateCcw className={cn("size-3.5", loading && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{tc("refresh")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-primary"
                  style={pointerStyle}
                  onClick={onNewSession}
                >
                  <Plus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{t("newSession")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Sessions list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
                <MessageSquare className="size-5 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("noSessions")}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {t("startConversation")}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map((session) => {
                const isActive = session.session_id === currentSessionId;
                const isLoading = loadingSession === session.session_id;

                return (
                  <div
                    key={session.session_id}
                    onClick={() => !isLoading && handleSelectSession(session)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!isLoading) handleSelectSession(session);
                      }
                    }}
                    style={pointerStyle}
                    className={cn(
                      "w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all group select-none",
                      isActive
                        ? "bg-primary/10 ring-1 ring-primary/20"
                        : "hover:bg-muted/60",
                      isLoading && "opacity-70"
                    )}
                  >
                    <div
                      style={pointerStyle}
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md mt-0.5",
                        isActive ? "bg-primary/20" : "bg-muted"
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                      ) : (
                        <MessageSquare className={cn(
                          "size-3.5",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )} />
                      )}
                    </div>
                    <div style={pointerStyle} className="flex-1 min-w-0 space-y-1">
                      <p
                        style={pointerStyle}
                        className={cn(
                          "text-xs font-medium truncate leading-tight",
                          isActive && "text-primary"
                        )}
                      >
                        {getSessionTitle(session)}
                      </p>
                      <div style={pointerStyle} className="flex items-center gap-2">
                        <span style={pointerStyle} className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-2.5" />
                          {formatRelativeTime(session.last_active_at)}
                        </span>
                        <span style={pointerStyle} className="text-[10px] text-muted-foreground/70">
                          {t("messages", { count: session.message_count })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            style={pointerStyle}
                            onClick={(e) => openDeleteDialog(e, session.session_id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{tc("delete")}</p>
                        </TooltipContent>
                      </Tooltip>
                      <ChevronRight className="size-3.5 text-muted-foreground/50" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteSession")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteSessionDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSession}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
