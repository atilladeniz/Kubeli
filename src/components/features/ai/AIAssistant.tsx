"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { Send, Square, Loader2, AlertCircle, X, Sparkles, User, Copy, Check, History, PanelLeftClose } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { useAIStore, type ChatMessage } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { ApprovalModal } from "./ApprovalModal";
import { SessionHistory } from "./SessionHistory";
import type { MessageRecord } from "@/lib/tauri/commands";

// AI Event types from backend
interface AIEventData {
  type: string;
  data: {
    session_id?: string;
    content?: string;
    done?: boolean;
    active?: boolean;
    tool_name?: string;
    status?: string;
    output?: string;
    request_id?: string;
    command_preview?: string;
    reason?: string;
    severity?: string;
    tool_input?: unknown;
    approved?: boolean;
    message?: string;
  };
}

// Format timestamp
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function AIAssistant() {
  const t = useTranslations();
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Thinking messages that cycle while AI is processing
  const thinkingMessages = [
    "Analysiere Anfrage...",
    "Durchsuche Cluster...",
    "Sammle Metriken...",
    "Verarbeite Daten...",
    "Prüfe Ressourcen...",
    "Lese Pod-Status...",
    "Analysiere Logs...",
    "Kubernetes-Magie...",
    "Kubeli-Hai schwimmt...",
    "Hai taucht in Pods...",
    "Bits werden sortiert...",
    "Hai jagt Bugs...",
    "Bereite Antwort vor...",
    "Kubectl im Kopf...",
    "Hai sammelt Daten...",
    "Geduld bringt Pods...",
    "Gut Ding will Weile...",
    "Gleich geht's los...",
    "Einen Moment noch...",
    "Wer wartet, gewinnt...",
    "Container werden geweckt...",
    "Nodes werden befragt...",
    "Hai macht Pause nicht...",
    "Kaffee wäre jetzt gut...",
    "Denke nach...",
    "Rechne kurz...",
    "Bin gleich da...",
    "Secrets werden gehütet...",
    "Namespaces erkundet...",
    "YAML wird gelesen...",
    "Helm Charts geprüft...",
    "Services entdeckt...",
    "Ingress analysiert...",
    "ConfigMaps geladen...",
    "Hai ist fleißig...",
    "Fast geschafft...",
  ];

  // Copy message to clipboard
  const copyMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      toast.success("Kopiert!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }, []);

  const {
    currentSessionId,
    isSessionActive,
    isThinking,
    isStreaming,
    error,
    startSession,
    sendMessage,
    interrupt,
    stopSession,
    appendMessageChunk,
    setThinking,
    setError,
    clearError,
    getConversation,
    clearConversation,
    loadSavedSession,
    addToolCall,
    setApprovalRequest,
    pendingAnalysis,
    clearPendingAnalysis,
  } = useAIStore();

  const { currentCluster, isConnected, currentNamespace } = useClusterStore();
  const { setPendingPodLogs, setAIAssistantOpen } = useUIStore();

  // Get current conversation
  const conversation = currentCluster
    ? getConversation(currentCluster.context)
    : undefined;
  const messages = useMemo(() => conversation?.messages || [], [conversation?.messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Cycle through thinking messages while thinking or streaming without content
  const isProcessing = isThinking || isStreaming;
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      setThinkingMessageIndex((prev) => (prev + 1) % 36); // 36 = thinkingMessages.length
    }, 1800);

    return () => {
      clearInterval(interval);
      // Reset index when processing stops
      setThinkingMessageIndex(0);
    };
  }, [isProcessing]);

  // Handle pending analysis (auto-send when AI panel opens with queued message)
  useEffect(() => {
    if (!pendingAnalysis || !currentCluster) return;
    if (pendingAnalysis.clusterContext !== currentCluster.context) return;

    const sendPendingAnalysis = async () => {
      const message = pendingAnalysis.message;
      clearPendingAnalysis();

      // Start session if not active
      if (!isSessionActive) {
        try {
          await startSession(currentCluster.context, pendingAnalysis.namespace);
        } catch {
          return;
        }
      }

      // Send the pending message
      try {
        await sendMessage(message);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message");
      }
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(sendPendingAnalysis, 100);
    return () => clearTimeout(timer);
  }, [pendingAnalysis, currentCluster, isSessionActive, startSession, sendMessage, setError, clearPendingAnalysis]);

  // Listen for AI events
  useEffect(() => {
    if (!currentSessionId) return;

    const eventName = `ai-session-${currentSessionId}`;
    const unlisten = listen<AIEventData>(eventName, (event) => {
      const { type, data } = event.payload;

      switch (type) {
        case "MessageChunk":
          appendMessageChunk(data.content || "", data.done || false);
          break;
        case "Thinking":
          setThinking(data.active || false);
          break;
        case "ToolExecution":
          addToolCall({
            name: data.tool_name || "unknown",
            status: (data.status as "pending" | "running" | "completed" | "failed") || "running",
            output: data.output,
          });
          break;
        case "ApprovalRequired":
          // Tool execution requires approval
          if (data.request_id && data.tool_name) {
            setApprovalRequest({
              request_id: data.request_id,
              session_id: currentSessionId,
              tool_name: data.tool_name,
              tool_input: data.tool_input || {},
              command_preview: data.command_preview || "",
              reason: data.reason || "Action requires approval",
              severity: (data.severity as "low" | "medium" | "high" | "critical") || "medium",
            });
            setApprovalModalOpen(true);
          }
          break;
        case "ApprovalResponse":
          // Approval was submitted
          setApprovalModalOpen(false);
          if (data.approved) {
            toast.success("Aktion genehmigt");
          } else {
            toast.info("Aktion abgelehnt");
          }
          break;
        case "ToolBlocked":
          // Tool was blocked by permission system
          toast.error(`Blockiert: ${data.reason || "Keine Berechtigung"}`);
          addToolCall({
            name: data.tool_name || "blocked",
            status: "failed",
            output: data.reason || "Action was blocked by permission system",
          });
          break;
        case "Error":
          setError(data.message || "Unknown error");
          break;
        case "SessionEnded":
          // Session ended, reset state
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [currentSessionId, appendMessageChunk, setThinking, setError, addToolCall, setApprovalRequest]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Start session if not active
    if (!isSessionActive && currentCluster) {
      try {
        await startSession(currentCluster.context, currentNamespace || undefined);
      } catch {
        return;
      }
    }

    // Send message
    try {
      await sendMessage(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    }
  }, [input, isStreaming, isSessionActive, currentCluster, currentNamespace, startSession, sendMessage, setError]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle interrupt
  const handleInterrupt = useCallback(() => {
    interrupt();
  }, [interrupt]);

  // Handle selecting a saved session from history
  const handleSelectSession = useCallback((sessionId: string, messages: MessageRecord[]) => {
    if (currentCluster) {
      loadSavedSession(sessionId, messages, currentCluster.context);
      setShowHistory(false);
    }
  }, [currentCluster, loadSavedSession]);

  // Handle creating a new session (clear current conversation)
  const handleNewSession = useCallback(() => {
    if (currentCluster) {
      // Stop current session if active
      if (isSessionActive) {
        stopSession();
      }
      clearConversation(currentCluster.context);
      setShowHistory(false);
    }
  }, [currentCluster, isSessionActive, stopSession, clearConversation]);

  // Render message
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === "user";
    const isCopied = copiedId === message.id;

    return (
      <div
        key={message.id}
        className={cn(
          "group flex gap-3 p-4",
          isUser ? "bg-muted/40" : "bg-background"
        )}
      >
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
          )}
        >
          {isUser ? (
            <User className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2 select-text">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {isUser ? "You" : "AI Assistant"}
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                {formatTime(message.timestamp)}
              </span>
            </div>
            {!isUser && message.content && !message.isStreaming && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 cursor-pointer"
                onClick={() => copyMessage(message.id, message.content)}
              >
                {isCopied ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            )}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            {isUser ? (
              <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
            ) : (
              <>
{/* Show shimmer indicator while streaming - hide content until done */}
                {message.isStreaming && isStreaming ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-violet-500" />
                    <ShimmeringText
                      text={thinkingMessages[thinkingMessageIndex]}
                      duration={1.5}
                      className="text-sm"
                      startOnView={false}
                    />
                  </div>
                ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Custom code block styling
                    pre: ({ children }) => (
                      <pre className="overflow-x-auto rounded-lg bg-muted/50 border p-3 text-xs my-3 whitespace-pre-wrap break-words">
                        {children}
                      </pre>
                    ),
                    code: ({ className, children, ...props }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className="text-xs font-mono block" {...props}>
                          {children}
                        </code>
                      );
                    },
                    // Lists
                    ul: ({ children }) => (
                      <ul className="list-disc list-outside ml-4 space-y-1 my-2">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-outside ml-4 space-y-1 my-2">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm pl-1">{children}</li>
                    ),
                    // Headings
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>
                    ),
                    // Paragraphs
                    p: ({ children }) => (
                      <p className="text-sm leading-relaxed mb-3 last:mb-0">{children}</p>
                    ),
                    // Strong/Bold
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                    // Tables
                    table: ({ children }) => (
                      <div className="my-3 overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-muted/50">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-border">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="border-b border-border last:border-0">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{children}</td>
                    ),
                    // Links - handle kubeli:// links specially, prevent default browser navigation
                    a: ({ href, children }) => {
                      // Check if it's a kubeli:// internal link
                      if (href?.startsWith("kubeli://logs/")) {
                        const parts = href.replace("kubeli://logs/", "").split("/");
                        const linkNamespace = parts[0];
                        const linkPodName = parts.slice(1).join("/");
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Set pending pod logs - PodsView will pick this up
                              setPendingPodLogs({ namespace: linkNamespace, podName: linkPodName });
                              toast.success(`Navigiere zu ${linkNamespace}/${linkPodName}`, {
                                description: "Wechsle zur Pods-Ansicht um die Logs zu sehen",
                              });
                            }}
                            style={{ cursor: "pointer" }}
                            className="text-primary hover:underline font-medium inline bg-transparent border-none p-0"
                          >
                            {children}
                          </button>
                        );
                      }
                      // For external links, show as text (don't navigate)
                      return (
                        <span
                          style={{ cursor: "pointer" }}
                          className="text-primary hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (href) {
                              navigator.clipboard.writeText(href);
                              toast.success("Link kopiert!");
                            }
                          }}
                          title={href}
                        >
                          {children}
                        </span>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Not connected state
  if (!isConnected || !currentCluster) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 mb-4">
          <Sparkles className="size-8 text-violet-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{t("ai.title")}</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {t("cluster.selectClusterDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-allow-context-menu>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <Sparkles className="size-3.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold leading-tight">{t("ai.title")}</h3>
              <ProviderBadge />
            </div>
            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
              {currentCluster.context}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "size-7 cursor-pointer transition-colors",
              showHistory ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
            )}
            title={showHistory ? "Verlauf ausblenden" : "Verlauf anzeigen"}
          >
            {showHistory ? <PanelLeftClose className="size-3.5" /> : <History className="size-3.5" />}
          </Button>
          {isSessionActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => stopSession()}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Beenden
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // Interrupt if still processing
              if (isStreaming || isThinking) {
                interrupt();
                toast.info("AI Session wurde beendet");
              }
              setAIAssistantOpen(false);
            }}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm border-b border-destructive/20">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1 text-xs">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0 hover:bg-destructive/20"
            onClick={clearError}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      {/* Main content area with optional history panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Session History Panel */}
        <div
          className={cn(
            "border-r bg-muted/20 flex-shrink-0 transition-all duration-200 ease-in-out overflow-hidden",
            showHistory ? "w-56" : "w-0"
          )}
        >
          {currentCluster && (
            <div className="w-56">
              <SessionHistory
                clusterContext={currentCluster.context}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
              />
            </div>
          )}
        </div>

        {/* Messages - scrollable area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 mb-4">
              <Sparkles className="size-7 text-violet-500/70" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("ai.startConversation")}
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {[
                "What pods are failing?",
                "Show deployment status",
                "Analyze pod logs",
                "Any resource issues?",
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 cursor-pointer"
                  onClick={() => {
                    setInput(prompt);
                    textareaRef.current?.focus();
                  }}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map(renderMessage)}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
          )}
        </div>
      </div>

      {/* Input area - fixed at bottom */}
      <div className="border-t bg-background p-4">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize textarea
              const textarea = e.target;
              textarea.style.height = "auto";
              textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("ai.placeholder")}
            className="min-h-[44px] max-h-[200px] resize-none text-sm field-sizing-content"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              size="icon"
              variant="destructive"
              onClick={handleInterrupt}
              className="shrink-0 size-10 cursor-pointer"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="shrink-0 size-10 cursor-pointer"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Enter to send / Shift+Enter for new line
        </p>
      </div>

      {/* Approval Modal */}
      <ApprovalModal
        open={approvalModalOpen}
        onOpenChange={setApprovalModalOpen}
      />
    </div>
  );
}

// Provider badge showing which AI CLI is being used
function ProviderBadge() {
  const { settings } = useUIStore();
  const provider = settings.aiCliProvider || "claude";

  return (
    <span
      className={cn(
        "text-[9px] font-medium px-1.5 py-0.5 rounded-full",
        provider === "claude"
          ? "bg-orange-500/10 text-orange-500"
          : "bg-emerald-500/10 text-emerald-500"
      )}
    >
      {provider === "claude" ? "Claude" : "Codex"}
    </span>
  );
}
