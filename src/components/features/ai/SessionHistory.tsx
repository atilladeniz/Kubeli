"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  aiListSavedSessions,
  aiDeleteSavedSession,
  aiGetConversationHistory,
  type SessionSummary,
  type MessageRecord,
} from "@/lib/tauri/commands";
import {
  EmptySessionList,
  SessionHistoryHeader,
  SessionItem,
} from "./components";
import { DeleteSessionDialog } from "./dialogs";
import { formatRelativeTime, getSessionTitle } from "./lib/utils";

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
  const handleSelectSession = useCallback(
    async (session: SessionSummary) => {
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
    },
    [currentSessionId, onSelectSession, t]
  );

  // Handle session deletion
  const handleDeleteSession = useCallback(async () => {
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
  }, [sessionToDelete, t]);

  const openDeleteDialog = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <SessionHistoryHeader
          title={t("sessionHistory")}
          refreshLabel={tc("refresh")}
          newSessionLabel={t("newSession")}
          loading={loading}
          onRefresh={loadSessions}
          onNewSession={onNewSession}
        />

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <EmptySessionList
              noSessionsLabel={t("noSessions")}
              startConversationLabel={t("startConversation")}
            />
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <SessionItem
                  key={session.session_id}
                  session={session}
                  isActive={session.session_id === currentSessionId}
                  isLoading={loadingSession === session.session_id}
                  onSelect={() => handleSelectSession(session)}
                  onDelete={(e) => openDeleteDialog(e, session.session_id)}
                  formatTime={(dateStr) => formatRelativeTime(dateStr, t("justNow"))}
                  getTitle={getSessionTitle}
                  messagesLabel={t("messages", { count: session.message_count })}
                  deleteLabel={tc("delete")}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <DeleteSessionDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteSession}
        />
      </div>
    </TooltipProvider>
  );
}
