import { readFileSync } from "fs";
import { join } from "path";

// Regression guard for the Tauri hardening pass: broad fs scopes and
// inline-script CSP must not silently come back.

const root = join(__dirname, "..", "..");

describe("tauri security config", () => {
  it("CSP script-src has no unsafe-inline", () => {
    const conf = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
    const csp: string = conf.app.security.csp;
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("fs capability has no broad home/desktop/document/download scopes", () => {
    const cap = JSON.parse(
      readFileSync(join(root, "src-tauri", "capabilities", "default.json"), "utf8")
    );
    const stringPerms = cap.permissions.filter((p: unknown) => typeof p === "string");
    for (const perm of stringPerms) {
      expect(perm).not.toMatch(/^fs:.*(home|desktop|document|download)/);
    }
  });

  it("index.html has no inline scripts (CSP would block them)", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);
    expect(inlineScripts).toEqual([]);
  });
});
