import { languageCodes } from "../config";
import { getMessages } from "../getMessages";

// Flattens nested catalogs to "ns.key" paths; arrays count as one leaf.
function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? keyPaths(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}

describe("message catalogs", () => {
  const enKeys = keyPaths(getMessages("en")).sort();

  it.each(languageCodes.filter((lang) => lang !== "en"))(
    "%s has exactly the same keys as en",
    (lang) => {
      expect(keyPaths(getMessages(lang)).sort()).toEqual(enKeys);
    }
  );
});
