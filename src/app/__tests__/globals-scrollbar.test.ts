import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for #474: any unscoped `::-webkit-scrollbar` rule opts WebKit
 * out of the macOS overlay scrollbars and ignores the user's "Show scroll bars"
 * preference. Custom scrollbar styling must stay behind a platform class.
 */
describe("globals.css scrollbar styling", () => {
  const css = readFileSync(join(__dirname, "..", "globals.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  const selectors = css
    .split("}")
    .map((block) => block.split("{")[0].trim())
    .filter((selector) => selector.includes("::-webkit-scrollbar"));

  it("has scrollbar rules to check", () => {
    expect(selectors.length).toBeGreaterThan(0);
  });

  it("scopes every ::-webkit-scrollbar rule to a platform class or an opt-in utility", () => {
    const unscoped = selectors
      // split on commas outside parentheses so `:is(.dark, .classic-dark)` stays intact
      .flatMap((selector) => selector.split(/,(?![^(]*\))/))
      .map((selector) => selector.trim())
      .filter(
        (selector) =>
          !selector.includes(".platform-windows") &&
          !selector.includes(".platform-linux") &&
          !selector.startsWith(".hide-scrollbar")
      );

    expect(unscoped).toEqual([]);
  });
});
