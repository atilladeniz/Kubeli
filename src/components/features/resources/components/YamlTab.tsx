"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import "@/lib/monaco-config";
import { Copy, Check, Search, Pencil, Save, RotateCcw, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

interface YamlTabProps {
  yamlContent: string;
  hasChanges: boolean;
  onYamlChange: (value: string | undefined) => void;
  onCopyYaml: () => Promise<void>;
  onSave?: () => Promise<void>;
  onReset?: () => void;
  copied: boolean;
  canEdit: boolean;
  isSaving?: boolean;
  isActive?: boolean;
}

export function YamlTab({
  yamlContent,
  hasChanges,
  onYamlChange,
  onCopyYaml,
  onSave,
  onReset,
  copied,
  canEdit,
  isSaving,
  isActive,
}: YamlTabProps) {
  const t = useTranslations();
  const { resolvedTheme } = useUIStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showReadOnlyHint, setShowReadOnlyHint] = useState(false);
  const readOnlyHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showReadOnlyNotification = useCallback(() => {
    if (readOnlyHintTimer.current) clearTimeout(readOnlyHintTimer.current);
    setShowReadOnlyHint(true);
    readOnlyHintTimer.current = setTimeout(() => setShowReadOnlyHint(false), 3000);
  }, []);

  const handleEditorMount = (
    editorInstance: editor.IStandaloneCodeEditor,
    monacoInstance: Monaco
  ) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // Replace Monaco's default "Cannot edit in read-only editor" with our custom notification
    editorInstance.onDidAttemptReadOnlyEdit(() => {
      if (canEdit) showReadOnlyNotification();
    });
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

  const handleSearch = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.getAction("actions.find")?.run();
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setTimeout(() => editorRef.current?.focus(), 50);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    if (hasChanges) {
      onReset?.();
    }
  };

  const handleSave = async () => {
    await onSave?.();
    setIsEditing(false);
  };

  // ESC exits edit mode when the Monaco find widget is not open
  useEffect(() => {
    if (!isEditing || !editorRef.current) return;
    const editor = editorRef.current;
    const disposable = editor.onKeyDown((e) => {
      if (e.keyCode === monacoRef.current?.KeyCode.Escape) {
        // Let Monaco handle ESC if the find widget is visible
        const findController = editor.getContribution("editor.contrib.findController") as { getState?: () => { isRevealed?: boolean } } | null;
        if (findController?.getState?.()?.isRevealed) return;
        e.preventDefault();
        e.stopPropagation();
        handleCancelEditing();
      }
    });
    return () => disposable.dispose();
  }, [isEditing, hasChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  const readOnly = !isEditing || !canEdit;
  const isMac =
    typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
  const modKey = isMac ? "\u2318" : "Ctrl+";

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <span className="text-xs font-medium text-amber-500">
              {t("resourceDetail.editYaml")}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">YAML</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Save & Reset - only when editing with changes */}
          {isEditing && hasChanges && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    disabled={isSaving}
                    className="h-7 text-xs gap-1"
                  >
                    <RotateCcw className="size-3" />
                    {t("common.reset")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.reset")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-7 text-xs gap-1"
                  >
                    <Save className="size-3" />
                    {isSaving ? t("common.loading") : t("common.save")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t("common.save")} ({modKey}S)
                </TooltipContent>
              </Tooltip>
              <div className="w-px h-4 bg-border mx-1" />
            </>
          )}

          {/* Cancel edit mode */}
          {isEditing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancelEditing}
                  className="size-7"
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.cancel")} (Esc)</TooltipContent>
            </Tooltip>
          )}

          {/* Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSearch}
                className="size-7"
              >
                <Search className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("common.search")} ({modKey}F)
            </TooltipContent>
          </Tooltip>

          {/* Edit toggle */}
          {canEdit && !isEditing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleStartEditing}
                  className="size-7"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.edit")}</TooltipContent>
            </Tooltip>
          )}

          {/* Copy */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopyYaml}
                className={cn("size-7", copied && "text-green-500")}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {copied ? t("common.copied") : t("common.copy")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 relative">
        {/* Read-only notification */}
        {canEdit && !isEditing && (
          <div
            className={cn(
              "absolute top-3 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ease-out",
              showReadOnlyHint
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            )}
          >
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
              <Lock className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                {t("resourceDetail.readOnly")}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  setShowReadOnlyHint(false);
                  handleStartEditing();
                }}
                className="h-6 text-xs gap-1 px-2.5"
              >
                <Pencil className="size-3" />
                {t("common.edit")}
              </Button>
            </div>
          </div>
        )}

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
            readOnlyMessage: { value: "" },
            smoothScrolling: false,
            renderWhitespace: "none",
            renderLineHighlight: isEditing ? "line" : "none",
            renderLineHighlightOnlyWhenFocus: true,
            quickSuggestions: false,
            folding: true,
            foldingHighlight: false,
            matchBrackets: isEditing ? "always" : "never",
            occurrencesHighlight: isEditing ? "singleFile" : "off",
            selectionHighlight: isEditing,
            codeLens: false,
            contextmenu: isEditing,
            fontLigatures: false,
            renderValidationDecorations: "off",
            cursorBlinking: "solid",
            cursorSmoothCaretAnimation: "off",
            guides: {
              indentation: isEditing,
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
