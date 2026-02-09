"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import "@/lib/monaco-config";
import { X, Loader2 } from "lucide-react";
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
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";
import { applyResourceYaml } from "@/lib/tauri/commands";
import { toast } from "sonner";
import { k8sTemplates, getTemplatesByCategory, type K8sTemplate } from "@/lib/templates/k8s-templates";

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
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templatesByCategory = getTemplatesByCategory();

  const handleTemplateChange = useCallback((value: string) => {
    setSelectedTemplate(value);
    setError(null);

    // Find template by "category/kind" value
    const [category, kind] = value.split("/");
    let template: K8sTemplate | undefined;
    for (const templates of Object.values(templatesByCategory)) {
      template = templates.find((t) => t.category === category && t.kind === kind);
      if (template) break;
    }

    if (template) {
      setYamlContent(template.yaml);
    }
  }, [templatesByCategory]);

  const handleApply = useCallback(async () => {
    if (!yamlContent.trim()) return;

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
  }, [yamlContent, t, onApplied, onClose]);

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
        handleApply();
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
        onClose();
      }
    });
    return () => disposable.dispose();
  }, [onClose]);

  // Global ESC handler for when editor doesn't have focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Don't close if typing in select
        const target = e.target as HTMLElement;
        if (target.closest("[data-radix-select-content]")) return;
        // Don't close if Monaco has focus (handled by editor's own ESC handler)
        if (target.closest(".monaco-editor")) return;
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="size-7">
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Toolbar: apply + template selector */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!yamlContent.trim() || isApplying}
          className="h-7 text-xs gap-1"
        >
          {isApplying && <Loader2 className="size-3 animate-spin" />}
          {isApplying ? t("applying") : t("apply")}
        </Button>
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
            renderValidationDecorations: "off",
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

    </div>
  );
}

function camelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
}
