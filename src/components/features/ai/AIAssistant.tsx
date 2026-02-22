"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { SessionHistory } from "./SessionHistory";
import {
  AIHeader,
  ChatInput,
  EmptyState,
  ErrorBanner,
  MessageRenderer,
  NotConnectedState,
} from "./components";
import { ApprovalModal } from "./dialogs";
import {
  useAIEvents,
  useAISession,
  usePendingAnalysis,
  useThinkingMessage,
} from "./hooks";
import type { MessageRecord } from "@/lib/tauri/commands";

export function AIAssistant() {
  const t = useTranslations();
  const [input, setInput] = useState("");
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    currentSessionId,
    isSessionActive,
    isThinking,
    isStreaming,
    error,
    interrupt,
    stopSession,
    clearError,
    getConversation,
    clearConversation,
    loadSavedSession,
  } = useAIStore();

  const { currentCluster, isConnected } = useClusterStore();

  // Session management hook
  const sessionOptions = useMemo(
    () => ({ fallbackErrorMessage: t("ai.failedToSendMessage") }),
    [t]
  );
  const { textareaRef, handleSend: sendMessage } = useAISession(sessionOptions);
  const { setPendingPodLogs, setAIAssistantOpen } = useUIStore();

  // Handle pending analysis from context menus
  usePendingAnalysis();

  // Get current conversation
  const conversation = currentCluster
    ? getConversation(currentCluster.context)
    : undefined;
  const messages = useMemo(
    () => conversation?.messages || [],
    [conversation?.messages]
  );

  // Processing state for thinking message cycling
  const isProcessing = isThinking || isStreaming;
  const thinkingMessages = t.raw("ai.thinkingMessages") as string[];
  const thinkingMessage = useThinkingMessage(isProcessing, thinkingMessages);

  // Subscribe to AI events
  const eventCallbacks = useMemo(
    () => ({
      onApprovalRequired: () => setApprovalModalOpen(true),
      onApprovalResponse: () => setApprovalModalOpen(false),
    }),
    []
  );
  const eventI18n = useMemo(
    () => ({
      actionApproved: t("ai.actionApproved"),
      actionDenied: t("ai.actionDenied"),
      blocked: t("ai.blocked"),
      noPermission: t("ai.noPermission"),
      actionRequiresApproval: t("ai.actionRequiresApproval"),
      actionBlockedByPermission: t("ai.actionBlockedByPermission"),
      unknownError: t("ai.unknownError"),
    }),
    [t]
  );
  useAIEvents(currentSessionId, eventCallbacks, eventI18n);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Handle send message
  const handleSend = useCallback(async () => {
    const success = await sendMessage(input);
    if (success) {
      setInput("");
    }
  }, [input, sendMessage]);

  // Handle kubeli:// link clicks
  const handleKubeliLink = useCallback(
    (namespace: string, podName: string) => {
      setPendingPodLogs({ namespace, podName });
    },
    [setPendingPodLogs]
  );

  // Handle selecting a saved session from history
  const handleSelectSession = useCallback(
    (sessionId: string, sessionMessages: MessageRecord[]) => {
      if (currentCluster) {
        loadSavedSession(sessionId, sessionMessages, currentCluster.context);
        setShowHistory(false);
      }
    },
    [currentCluster, loadSavedSession]
  );

  // Handle creating a new session
  const handleNewSession = useCallback(() => {
    if (currentCluster) {
      if (isSessionActive) stopSession();
      clearConversation(currentCluster.context);
      setShowHistory(false);
    }
  }, [currentCluster, isSessionActive, stopSession, clearConversation]);

  // Handle quick prompt selection
  const handleSelectPrompt = useCallback(
    (prompt: string) => {
      setInput(prompt);
      textareaRef.current?.focus();
    },
    [textareaRef]
  );

  // Handle close button
  const handleClose = useCallback(() => {
    if (isStreaming || isThinking) {
      interrupt();
      toast.info(t("ai.sessionEnded"));
    }
    setAIAssistantOpen(false);
  }, [isStreaming, isThinking, interrupt, setAIAssistantOpen, t]);

  // Not connected state
  if (!isConnected || !currentCluster) {
    return (
      <NotConnectedState
        title={t("ai.title")}
        description={t("cluster.selectClusterDesc")}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-allow-context-menu>
      <AIHeader
        title={t("ai.title")}
        clusterContext={currentCluster.context}
        showHistory={showHistory}
        isSessionActive={isSessionActive}
        onToggleHistory={() => setShowHistory(!showHistory)}
        onStopSession={stopSession}
        onClose={handleClose}
        stopLabel={t("ai.stop")}
      />

      {error && <ErrorBanner error={error} onDismiss={clearError} />}

      {/* Main content area with optional history panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Session History Panel */}
        <div
          className={cn(
            "border-r bg-muted/20 shrink-0 transition-all duration-200 ease-in-out overflow-hidden",
            showHistory ? "w-56" : "w-0"
          )}
        >
          <div className="w-56 h-full">
            <SessionHistory
              clusterContext={currentCluster.context}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
            />
          </div>
        </div>

        {/* Messages - scrollable area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {messages.length === 0 ? (
            <EmptyState t={t} onSelectPrompt={handleSelectPrompt} />
          ) : (
            <div className="divide-y divide-border/50">
              {messages.map((message) => (
                <MessageRenderer
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming}
                  thinkingMessage={thinkingMessage}
                  onKubeliLink={handleKubeliLink}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <ChatInput
        ref={textareaRef}
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onInterrupt={interrupt}
        placeholder={t("ai.placeholder")}
        isStreaming={isStreaming}
        isThinking={isThinking}
      />

      <ApprovalModal
        open={approvalModalOpen}
        onOpenChange={setApprovalModalOpen}
      />
    </div>
  );
}
