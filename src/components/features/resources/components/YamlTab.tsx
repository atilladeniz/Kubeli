"use client";

import { useRef, useEffect } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import "@/lib/monaco-config";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";

interface YamlTabProps {
  yamlContent: string;
  hasChanges: boolean;
  onYamlChange: (value: string | undefined) => void;
  onCopyYaml: () => Promise<void>;
  copied: boolean;
  readOnly: boolean;
  isActive?: boolean;
}

export function YamlTab({
  yamlContent,
  hasChanges,
  onYamlChange,
  onCopyYaml,
  copied,
  readOnly,
  isActive,
}: YamlTabProps) {
  const t = useTranslations();
  const { resolvedTheme } = useUIStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorMount = (
    editorInstance: editor.IStandaloneCodeEditor,
    monacoInstance: Monaco
  ) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;
  };

  // When the tab becomes visible, force Monaco to remeasure fonts and layout.
  // Monaco initializes with wrong font metrics when mounted in a hidden container
  // (forceMount + display:none), causing click-to-cursor position miscalculation.
  useEffect(() => {
    if (isActive && editorRef.current && monacoRef.current) {
      monacoRef.current.editor.remeasureFonts();
      editorRef.current.layout();
    }
  }, [isActive]);

  return (
    <div className="h-full flex flex-col">

      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">
          {hasChanges ? t("resourceDetail.editYaml") : "—"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopyYaml}
          className="h-7 text-xs"
        >
          {copied ? (
            <Check className="size-3 text-green-500" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? t("common.copied") : t("common.copy")}
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          value={yamlContent}
          onChange={onYamlChange}
          onMount={handleEditorMount}
          theme={
            resolvedTheme === "dark" || resolvedTheme === "classic-dark"
              ? "vs-dark"
              : "light"
          }
          loading={
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t("common.loading")}
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "off",
            readOnly,
            smoothScrolling: false,
            renderWhitespace: "none",
            renderLineHighlight: "none",
            renderLineHighlightOnlyWhenFocus: true,
            quickSuggestions: false,
            folding: true,
            foldingHighlight: false,
            matchBrackets: "never",
            occurrencesHighlight: "off",
            selectionHighlight: false,
            codeLens: false,
            contextmenu: false,
            fontLigatures: false,
            renderValidationDecorations: "off",
            cursorBlinking: "solid",
            cursorSmoothCaretAnimation: "off",
            guides: {
              indentation: false,
              bracketPairs: false,
              highlightActiveIndentation: false,
            },
            colorDecorators: false,
            links: false,
            hover: { enabled: false },
            parameterHints: { enabled: false },
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnEnter: "off",
            inlineSuggest: { enabled: false },
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
        />
      </div>
    </div>
  );
}
