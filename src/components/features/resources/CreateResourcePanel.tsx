"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import "@/lib/monaco-config";
import { parseAllDocuments, type YAMLError } from "yaml";
import { X, Loader2, CircleAlert, ChevronDown, ChevronUp, Copy, CopyCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { DiscardChangesDialog } from "./dialogs/DiscardChangesDialog";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";
import { applyResourceYaml } from "@/lib/tauri/commands";
import { toast } from "sonner";
import { k8sTemplates, getTemplatesByCategory, type K8sTemplate } from "@/lib/templates/k8s-templates";

interface LintError {
  line: number;
  col: number;
  message: string;
}

interface CreateResourcePanelProps {
  onClose: () => void;
  onApplied: () => void;
}

export function CreateResourcePanel({ onClose, onApplied }: CreateResourcePanelProps) {
  const t = useTranslations("createResource");
  const tCommon = useTranslations("common");
  const { resolvedTheme, settings } = useUIStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const defaultTemplate = k8sTemplates[0];
  const defaultValue = `${defaultTemplate.category}/${defaultTemplate.kind}`;
  const [yamlContent, setYamlContent] = useState(defaultTemplate.yaml);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(defaultValue);
  const [templateYaml, setTemplateYaml] = useState(defaultTemplate.yaml);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [lintErrors, setLintErrors] = useState<LintError[]>([]);
  const [showLintPanel, setShowLintPanel] = useState(false);

  const hasChanges = yamlContent !== templateYaml;
  const hasLintErrors = lintErrors.length > 0;

  const templatesByCategory = getTemplatesByCategory();

  // Real-time YAML linting
  useEffect(() => {
    if (!yamlContent.trim()) {
      setLintErrors([]);
      return;
    }

    const errors: LintError[] = [];
    try {
      const docs = parseAllDocuments(yamlContent);
      for (const doc of docs) {
        for (const err of doc.errors) {
          const pos = getErrorPosition(err);
          errors.push({
            line: pos.line,
            col: pos.col,
            message: err.message,
          });
        }
      }
    } catch {
      errors.push({ line: 1, col: 1, message: "Failed to parse YAML" });
    }

    setLintErrors(errors);
  }, [yamlContent]);

  // Set Monaco editor markers for inline error squiggles
  useEffect(() => {
    const editorInstance = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!editorInstance || !monacoInstance) return;

    const model = editorInstance.getModel();
    if (!model) return;

    const markers = lintErrors.map((err) => ({
      severity: monacoInstance.MarkerSeverity.Error,
      message: err.message,
      startLineNumber: err.line,
      startColumn: err.col,
      endLineNumber: err.line,
      endColumn: model.getLineMaxColumn(err.line),
    }));

    monacoInstance.editor.setModelMarkers(model, "yaml-lint", markers);
  }, [lintErrors]);

  const handleTemplateChange = useCallback((value: string) => {
    setSelectedTemplate(value);
    setError(null);

    const [category, kind] = value.split("/");
    let template: K8sTemplate | undefined;
    for (const templates of Object.values(templatesByCategory)) {
      template = templates.find((t) => t.category === category && t.kind === kind);
      if (template) break;
    }

    if (template) {
      setYamlContent(template.yaml);
      setTemplateYaml(template.yaml);
    }
  }, [templatesByCategory]);

  const handleApply = useCallback(async () => {
    if (!yamlContent.trim() || hasLintErrors) return;

    setIsApplying(true);
    setError(null);

    try {
      await applyResourceYaml(yamlContent);
      toast.success(t("applySuccess"));
      onApplied();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsApplying(false);
    }
  }, [yamlContent, hasLintErrors, t, onApplied, onClose]);

  // Ref so Monaco addCommand always sees the latest handleApply
  const handleApplyRef = useRef(handleApply);
  handleApplyRef.current = handleApply;

  const requestClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    onClose();
  };

  const handleEditorMount = (
    editorInstance: editor.IStandaloneCodeEditor,
    monacoInstance: Monaco
  ) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // Cmd/Ctrl+S to apply
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        handleApplyRef.current();
      }
    );
  };

  // ESC closes panel when Monaco find widget is not open
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editorInstance = editorRef.current;
    const disposable = editorInstance.onKeyDown((e) => {
      if (e.keyCode === monacoRef.current?.KeyCode.Escape) {
        const findController = editorInstance.getContribution("editor.contrib.findController") as { getState?: () => { isRevealed?: boolean } } | null;
        if (findController?.getState?.()?.isRevealed) return;
        e.preventDefault();
        e.stopPropagation();
        requestCloseRef.current();
      }
    });
    return () => disposable.dispose();
  }, []);

  // Global ESC handler for when editor doesn't have focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const target = e.target as HTMLElement;
        if (target.closest("[data-radix-select-content]")) return;
        if (target.closest(".monaco-editor")) return;
        requestCloseRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLintErrorClick = useCallback((err: LintError) => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    editorInstance.revealLineInCenter(err.line);
    editorInstance.setPosition({ lineNumber: err.line, column: err.col });
    editorInstance.focus();
  }, []);

  const formatLintError = useCallback((err: LintError) => {
    return `Line ${err.line}, Col ${err.col}: ${err.message}`;
  }, []);

  const copyErrorToClipboard = useCallback((err: LintError) => {
    navigator.clipboard.writeText(formatLintError(err));
    toast.success(tCommon("copied"));
  }, [formatLintError, tCommon]);

  const copyAllErrorsToClipboard = useCallback(() => {
    const text = lintErrors.map(formatLintError).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(tCommon("copied"));
  }, [lintErrors, formatLintError, tCommon]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <Button variant="ghost" size="icon" onClick={requestClose} className="size-7">
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Toolbar: apply + lint toggle + template selector */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!yamlContent.trim() || isApplying || hasLintErrors}
          className="h-7 text-xs gap-1"
        >
          {isApplying && <Loader2 className="size-3 animate-spin" />}
          {isApplying ? t("applying") : t("apply")}
        </Button>
        {hasLintErrors && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLintPanel((v) => !v)}
            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
          >
            <CircleAlert className="size-3.5" />
            {t("lintErrors", { count: lintErrors.length })}
            {showLintPanel ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          </Button>
        )}
        <div className="flex-1" />
        <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder={t("selectTemplate")} />
          </SelectTrigger>
          <SelectContent position="popper" align="end" className="max-h-[40vh]">
            {Object.entries(templatesByCategory).map(([category, templates], index) => (
              <SelectGroup key={category}>
                {index > 0 && <SelectSeparator />}
                <SelectLabel>{t(`categories.${camelCase(category)}`)}</SelectLabel>
                {templates.map((template) => (
                  <SelectItem
                    key={`${category}/${template.kind}`}
                    value={`${category}/${template.kind}`}
                  >
                    {template.kind}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error alert */}
      {error && (
        <div className="px-3 py-2 border-b border-border">
          <Alert variant="destructive">
            <AlertDescription className="text-xs break-all">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Monaco YAML editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          value={yamlContent}
          onChange={(value) => {
            setYamlContent(value || "");
            setError(null);
          }}
          onMount={handleEditorMount}
          theme={
            resolvedTheme === "dark" || resolvedTheme === "classic-dark"
              ? "vs-dark"
              : "light"
          }
          loading={
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {tCommon("loading")}
            </div>
          }
          options={{
            minimap: { enabled: false },
            find: { addExtraSpaceOnTop: false },
            fontSize: settings.editorFontSize,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: settings.editorWordWrap ? "on" : "off",
            readOnly: false,
            smoothScrolling: false,
            renderWhitespace: "none",
            renderLineHighlight: "line",
            renderLineHighlightOnlyWhenFocus: true,
            quickSuggestions: false,
            folding: true,
            foldingHighlight: false,
            matchBrackets: "always",
            occurrencesHighlight: "singleFile",
            selectionHighlight: true,
            codeLens: false,
            contextmenu: false,
            fontLigatures: false,
            renderValidationDecorations: "on",
            cursorBlinking: "solid",
            cursorSmoothCaretAnimation: "off",
            guides: {
              indentation: true,
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

      {/* Lint errors panel */}
      {showLintPanel && hasLintErrors && (
        <div className="border-t border-border max-h-32 overflow-y-auto bg-muted/50">
          {lintErrors.map((err, i) => (
            <ContextMenu key={i}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleLintErrorClick(err)}
                  className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/80 transition-colors"
                >
                  <CircleAlert className="size-3 mt-0.5 shrink-0 text-destructive" />
                  <span className="text-muted-foreground font-mono">
                    {t("lintErrorLine", { line: err.line, col: err.col, message: err.message })}
                  </span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => copyErrorToClipboard(err)}>
                  <Copy className="size-3.5" />
                  {t("copyError")}
                </ContextMenuItem>
                <ContextMenuItem onClick={copyAllErrorsToClipboard}>
                  <CopyCheck className="size-3.5" />
                  {t("copyAllErrors")}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}

      <DiscardChangesDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onConfirm={handleConfirmDiscard}
      />
    </div>
  );
}

function camelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

function getErrorPosition(err: YAMLError): { line: number; col: number } {
  if (err.linePos && err.linePos.length > 0) {
    return { line: err.linePos[0].line, col: err.linePos[0].col };
  }
  return { line: 1, col: 1 };
}
