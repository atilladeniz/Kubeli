import { expect, test } from "@playwright/test";

test("updates lint state from Monaco markers in create resource panel", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Connect" }).first().click();
  await page.keyboard.press("Meta+n");

  await expect(page.getByRole("heading", { name: "Create Resource" })).toBeVisible();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();

  await page.waitForFunction(() => {
    const monaco = (window as Window & { __KUBELI_MONACO__?: { editor: { getModels: () => unknown[] } } })
      .__KUBELI_MONACO__;
    return Boolean(monaco?.editor.getModels().length);
  });

  await page.evaluate(() => {
    type MonacoMarker = {
      severity: number;
      message: string;
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };

    type MonacoModel = {
      uri: { toString: () => string };
      getLanguageId: () => string;
    };

    const monaco = (
      window as Window & {
        __KUBELI_MONACO__?: {
          MarkerSeverity: { Error: number };
          editor: {
            getModels: () => MonacoModel[];
            setModelMarkers: (model: MonacoModel, owner: string, markers: MonacoMarker[]) => void;
          };
        };
      }
    ).__KUBELI_MONACO__;

    if (!monaco) {
      throw new Error("Monaco not exposed for E2E");
    }

    const model =
      monaco.editor.getModels().find((m) => m.uri.toString().includes("create-resource.yaml")) ??
      monaco.editor.getModels().find((m) => m.getLanguageId() === "yaml");

    if (!model) {
      throw new Error("YAML model not found");
    }

    monaco.editor.setModelMarkers(model, "e2e-lint-test", [
      {
        severity: monaco.MarkerSeverity.Error,
        message: "E2E lint marker",
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 2,
        endColumn: 8,
      },
    ]);
  });

  await expect(page.getByRole("button", { name: /error/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply" })).toBeDisabled();

  await page.evaluate(() => {
    type MonacoModel = {
      uri: { toString: () => string };
      getLanguageId: () => string;
    };

    const monaco = (
      window as Window & {
        __KUBELI_MONACO__?: {
          editor: {
            getModels: () => MonacoModel[];
            setModelMarkers: (model: MonacoModel, owner: string, markers: unknown[]) => void;
          };
        };
      }
    ).__KUBELI_MONACO__;

    if (!monaco) {
      throw new Error("Monaco not exposed for E2E");
    }

    const model =
      monaco.editor.getModels().find((m) => m.uri.toString().includes("create-resource.yaml")) ??
      monaco.editor.getModels().find((m) => m.getLanguageId() === "yaml");

    if (!model) {
      throw new Error("YAML model not found");
    }

    monaco.editor.setModelMarkers(model, "e2e-lint-test", []);
  });

  await expect(page.getByRole("button", { name: /error/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Apply" })).toBeEnabled();
});
