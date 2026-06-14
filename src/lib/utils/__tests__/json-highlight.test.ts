import { tokenizeJson } from "../json-highlight";

describe("tokenizeJson", () => {
  it("distinguishes a key from a string value by the following colon", () => {
    const tokens = tokenizeJson('  "targetRevision": "v1.0.0"');
    const key = tokens.find((t) => t.text === '"targetRevision"');
    const value = tokens.find((t) => t.text === '"v1.0.0"');

    expect(key?.kind).toBe("key");
    expect(value?.kind).toBe("string");
  });

  it("classifies numbers and keywords", () => {
    const tokens = tokenizeJson('"id": 42, "enabled": true, "x": null');
    expect(tokens.find((t) => t.text === "42")?.kind).toBe("number");
    expect(tokens.find((t) => t.text === "true")?.kind).toBe("keyword");
    expect(tokens.find((t) => t.text === "null")?.kind).toBe("keyword");
  });

  it("marks structural characters as punctuation", () => {
    const tokens = tokenizeJson("{},[]:");
    expect(tokens.every((t) => t.kind === "punctuation")).toBe(true);
    expect(tokens).toHaveLength(6);
  });

  it("round-trips the original text exactly", () => {
    const line = '    "repoURL": "https://github.com/example/demo-app.git",';
    expect(tokenizeJson(line).map((t) => t.text).join("")).toBe(line);
  });

  it("does not treat a colon inside a string value as a key marker", () => {
    const tokens = tokenizeJson('"https://example.com"');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("string");
  });

  it("handles escaped quotes inside strings", () => {
    const tokens = tokenizeJson('"a\\"b": 1');
    expect(tokens[0].text).toBe('"a\\"b"');
    expect(tokens[0].kind).toBe("key");
  });
});
