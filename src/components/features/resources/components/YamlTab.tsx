"use client";

import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef, type Ref } from "react";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DiscardChangesDialog } from "../dialogs/DiscardChangesDialog";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";
import { usePlatform } from "@/lib/hooks/usePlatform";
import { cn } from "@/lib/utils";

export interface YamlTabHandle {
  focusEditor: () => void;
}

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
  resourceKey?: string;
}

export const YamlTab = forwardRef<YamlTabHandle, YamlTabProps>(function YamlTab({
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
  resourceKey,
}: YamlTabProps, ref: Ref<YamlTabHandle>) {
  const t = useTranslations();
  const { resolvedTheme } = useUIStore();
  const { modKeySymbol } = usePlatform();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showReadOnlyHint, setShowReadOnlyHint] = useState(false);
  const [contextMenuSelection, setContextMenuSelection] = useState("");
  const readOnlyHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevResourceKey, setPrevResourceKey] = useState(resourceKey);
  const remeasureAndLayoutEditor = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;
    monacoRef.current.editor.remeasureFonts();
    editorRef.current.layout();
  }, []);
  const getSelectedText = useCallback(() => {
    const editorInstance = editorRef.current;
    const model = editorInstance?.getModel();
    const selection = editorInstance?.getSelection();
    if (!editorInstance || !model || !selection || selection.isEmpty()) return "";
    return model.getValueInRange(selection);
  }, []);

  // Reset edit mode when switching to a different resource
  if (resourceKey !== prevResourceKey) {
    setPrevResourceKey(resourceKey);
    if (isEditing) setIsEditing(false);
    if (showReadOnlyHint) setShowReadOnlyHint(false);
  }

  const showReadOnlyNotification = useCallback(() => {
    if (readOnlyHintTimer.current) clearTimeout(readOnlyHintTimer.current);
    setShowReadOnlyHint(true);
    readOnlyHintTimer.current = setTimeout(() => setShowReadOnlyHint(false), 3000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (readOnlyHintTimer.current) clearTimeout(readOnlyHintTimer.current);
    };
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

    // Cover async mount races: when YAML tab is already active, run layout once
    // immediately and once in the next frame so click-to-cursor math is correct.
    if (isActive) {
      remeasureAndLayoutEditor();
      requestAnimationFrame(() => remeasureAndLayoutEditor());
    }
  };

  // When the tab becomes visible, force Monaco to remeasure fonts and layout.
  // Monaco initializes with wrong font metrics when mounted in a hidden container
  // (forceMount + display:none), causing click-to-cursor position miscalculation.
  useEffect(() => {
    if (!isActive) return;
    remeasureAndLayoutEditor();
    requestAnimationFrame(() => remeasureAndLayoutEditor());
  }, [isActive, remeasureAndLayoutEditor]);

  const handleSearch = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.getAction("actions.find")?.run();
    }
  };

  const focusEditor = () => {
    setTimeout(() => editorRef.current?.focus(), 50);
  };

  const handleContextMenuOpenChange = (open: boolean) => {
    if (!open) return;
    setContextMenuSelection(getSelectedText());
  };

  const handleCopySelection = async () => {
    const selectedText = getSelectedText();
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
    } catch {
      await editorRef.current?.getAction("editor.action.clipboardCopyAction")?.run();
    }
  };

  useImperativeHandle(ref, () => ({ focusEditor }));

  const handleStartEditing = () => {
    setIsEditing(true);
    focusEditor();
  };

  const handleCancelEditing = () => {
    if (hasChanges) {
      setShowDiscardDialog(true);
    } else {
      setIsEditing(false);
    }
  };

  const handleDiscardDialogChange = (open: boolean) => {
    setShowDiscardDialog(open);
    // User dismissed dialog (Cancel or clicked outside) -> refocus editor
    if (!open) focusEditor();
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    setIsEditing(false);
    onReset?.();
  };

  const handleSave = async () => {
    try {
      await onSave?.();
      setIsEditing(false);
    } catch {
      // Error is handled by parent (error alert), keep edit mode active
      focusEditor();
    }
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
          {/* Save & Reset - visible in edit mode, disabled when no changes */}
          {isEditing && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { onReset?.(); focusEditor(); }}
                    disabled={!hasChanges || isSaving}
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
                    disabled={!hasChanges || isSaving}
                    className="h-7 text-xs gap-1"
                  >
                    <Save className="size-3" />
                    {isSaving ? t("common.loading") : t("common.save")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t("common.save")} ({modKeySymbol}S)
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
              {t("common.search")} ({modKeySymbol}F)
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
      <ContextMenu onOpenChange={handleContextMenuOpenChange}>
        <ContextMenuTrigger asChild>
          <div className="flex-1 min-h-0 relative" data-allow-context-menu>
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
                find: { addExtraSpaceOnTop: false },
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
                contextmenu: false,
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem onClick={handleCopySelection} disabled={!contextMenuSelection}>
            <Copy className="size-3.5" />
            {t("common.copy")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DiscardChangesDialog
        open={showDiscardDialog}
        onOpenChange={handleDiscardDialogChange}
        onConfirm={handleConfirmDiscard}
      />
    </div>
  );
});
