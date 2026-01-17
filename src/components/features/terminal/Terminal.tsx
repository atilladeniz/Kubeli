"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { Terminal as XTermType } from "@xterm/xterm";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";

export interface TerminalProps {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onReady?: (terminal: XTermType) => void;
  className?: string;
  fontSize?: number;
  fontFamily?: string;
}

export function Terminal({
  onData,
  onResize,
  onReady,
  className = "",
  fontSize = 14,
  fontFamily = "Menlo, Monaco, 'Courier New', monospace",
}: TerminalProps) {
  const t = useTranslations("terminal");
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Write data to terminal
  const write = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  // Clear terminal
  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  // Focus terminal
  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  // Fit terminal to container
  const fit = useCallback(() => {
    fitAddonRef.current?.fit();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let terminal: XTermType | null = null;
    let fitAddon: FitAddonType | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const initTerminal = async () => {
      // Dynamically import xterm modules
      const [xtermModule, fitModule, webLinksModule] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
      ]);

      if (!containerRef.current) return;

      const XTerm = xtermModule.Terminal;
      const FitAddon = fitModule.FitAddon;
      const WebLinksAddon = webLinksModule.WebLinksAddon;

      // Create terminal instance
      terminal = new XTerm({
        fontSize,
        fontFamily,
        cursorBlink: true,
        cursorStyle: "block",
        theme: {
          background: "#1e1e2e",
          foreground: "#cdd6f4",
          cursor: "#f5e0dc",
          cursorAccent: "#1e1e2e",
          selectionBackground: "#585b70",
          selectionForeground: "#cdd6f4",
          black: "#45475a",
          red: "#f38ba8",
          green: "#a6e3a1",
          yellow: "#f9e2af",
          blue: "#89b4fa",
          magenta: "#f5c2e7",
          cyan: "#94e2d5",
          white: "#bac2de",
          brightBlack: "#585b70",
          brightRed: "#f38ba8",
          brightGreen: "#a6e3a1",
          brightYellow: "#f9e2af",
          brightBlue: "#89b4fa",
          brightMagenta: "#f5c2e7",
          brightCyan: "#94e2d5",
          brightWhite: "#a6adc8",
        },
        allowProposedApi: true,
        scrollback: 10000,
        convertEol: true,
      });

      // Add addons
      fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // Open terminal in container
      terminal.open(containerRef.current);

      // Fit terminal to container
      fitAddon.fit();

      // Store refs
      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Handle data input
      terminal.onData((data) => {
        onData?.(data);
      });

      // Handle resize
      terminal.onResize(({ cols, rows }) => {
        onResize?.(cols, rows);
      });

      // Notify ready
      onReady?.(terminal);
      setIsLoaded(true);

      // Handle container resize
      resizeObserver = new ResizeObserver(() => {
        fitAddon?.fit();
      });
      resizeObserver.observe(containerRef.current);

      // Focus terminal
      terminal.focus();
    };

    initTerminal();

    return () => {
      resizeObserver?.disconnect();
      terminal?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [fontSize, fontFamily, onData, onResize, onReady]);

  // Expose methods via ref
  useEffect(() => {
    const element = containerRef.current;
    if (element) {
      (element as HTMLDivElement & { write: typeof write; clear: typeof clear; focus: typeof focus; fit: typeof fit }).write = write;
      (element as HTMLDivElement & { clear: typeof clear }).clear = clear;
      (element as HTMLDivElement & { focus: typeof focus }).focus = focus;
      (element as HTMLDivElement & { fit: typeof fit }).fit = fit;
    }
  }, [write, clear, focus, fit]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[200px] bg-[#1e1e2e] rounded-lg overflow-hidden ${className}`}
    >
      {!isLoaded && (
        <div className="flex items-center justify-center h-full text-[#6c7086]">
          {t("loading")}
        </div>
      )}
    </div>
  );
}

// Export imperative handle interface
export interface TerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
}
