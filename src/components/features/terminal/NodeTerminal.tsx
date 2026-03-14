"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import type { Terminal as XTermType } from "@xterm/xterm";
import { Terminal } from "./Terminal";
import { useNodeShell } from "@/lib/hooks/useNodeShell";

export interface NodeTerminalProps {
  nodeName: string;
  className?: string;
  onClose?: () => void;
  sessionId?: string;
}

export function NodeTerminal({
  nodeName,
  className = "",
  onClose,
  sessionId: tabSessionId,
}: NodeTerminalProps) {
  const terminalRef = useRef<XTermType | null>(null);
  const [autoConnect, setAutoConnect] = useState(true);

  const {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendInput,
    resize,
  } = useNodeShell(nodeName, {
    onOutput: (data) => {
      terminalRef.current?.write(data);
    },
    onError: (err) => {
      terminalRef.current?.write(`\r\n\x1b[31mError: ${err}\x1b[0m\r\n`);
    },
    onStarted: () => {
      // Output is already sent from backend
    },
    onClosed: () => {
      terminalRef.current?.write(`\r\n\x1b[33mSession closed\x1b[0m\r\n`);
    },
  }, tabSessionId);

  // Auto-connect when ready
  useEffect(() => {
    if (autoConnect && !isConnected && !isConnecting) {
      connect();
      queueMicrotask(() => {
        setAutoConnect(false);
      });
    }
  }, [autoConnect, isConnected, isConnecting, connect]);

  const handleData = useCallback(
    (data: string) => {
      if (isConnected) {
        sendInput(data);
      }
    },
    [isConnected, sendInput]
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (isConnected) {
        resize(cols, rows);
      }
    },
    [isConnected, resize]
  );

  const handleTerminalReady = useCallback((terminal: XTermType) => {
    terminalRef.current = terminal;
    terminal.write(`Connecting to node ${nodeName}...\r\n`);
  }, [nodeName]);

  const handleReconnect = useCallback(() => {
    terminalRef.current?.clear();
    terminalRef.current?.write(`Reconnecting to node ${nodeName}...\r\n`);
    connect();
  }, [connect, nodeName]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#181825] border-b border-[#313244]">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#cdd6f4]">
            <span className="text-[#cba6f7]">node</span>
            <span className="text-[#6c7086]"> / </span>
            {nodeName}
          </span>
          {/* Status indicator */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              isConnected
                ? "text-[#a6e3a1]"
                : isConnecting
                ? "text-[#f9e2af]"
                : "text-[#f38ba8]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? "bg-[#a6e3a1]"
                  : isConnecting
                  ? "bg-[#f9e2af] animate-pulse"
                  : "bg-[#f38ba8]"
              }`}
            />
            {isConnected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Reconnect button */}
          {!isConnected && !isConnecting && (
            <button
              onClick={handleReconnect}
              className="text-xs px-2 py-1 bg-[#89b4fa] text-[#1e1e2e] rounded hover:bg-[#74a8fc] transition-colors"
            >
              Reconnect
            </button>
          )}

          {/* Disconnect button */}
          {(isConnected || isConnecting) && (
            <button
              onClick={disconnect}
              className="text-xs px-2 py-1 bg-[#f38ba8] text-[#1e1e2e] rounded hover:bg-[#f17497] transition-colors"
            >
              Disconnect
            </button>
          )}

          {/* Close button */}
          {onClose && (
            <button
              onClick={() => {
                disconnect();
                onClose();
              }}
              className="text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-3 py-2 bg-[#45475a] text-[#f38ba8] text-sm border-b border-[#313244]">
          {error}
        </div>
      )}

      {/* Terminal */}
      <div className="flex-1 min-h-0">
        <Terminal
          onData={handleData}
          onResize={handleResize}
          onReady={handleTerminalReady}
          className="h-full"
        />
      </div>
    </div>
  );
}
