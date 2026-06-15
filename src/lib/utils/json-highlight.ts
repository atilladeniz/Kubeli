/**
 * Tiny JSON tokenizer for syntax coloring in the source diff viewer.
 *
 * Deliberately minimal: enough to color keys, string/number/keyword values and
 * punctuation in pretty-printed JSON, without pulling in a full highlighter like
 * Shiki. Operates per line (or per diff segment) and degrades to "plain" tokens
 * for anything it doesn't recognize, so partial fragments never throw.
 */

export type JsonTokenKind =
  | "key"
  | "string"
  | "number"
  | "keyword"
  | "punctuation"
  | "plain";

export interface JsonToken {
  text: string;
  kind: JsonTokenKind;
}

const WHITESPACE = /\s/;
const NUMBER_START = /[-0-9]/;
const NUMBER_BODY = /[-+0-9.eE]/;
const WORD = /[A-Za-z]/;
const PUNCTUATION = "{}[]:,";

/** Read a JSON string literal starting at `start` (which must be a quote). */
function readString(line: string, start: number): number {
  let i = start + 1;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    i++;
    if (ch === '"') break;
  }
  return i;
}

export function tokenizeJson(line: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  const n = line.length;

  while (i < n) {
    const ch = line[i];

    if (ch === '"') {
      const end = readString(line, i);
      const text = line.slice(i, end);
      // A string immediately followed by a colon (ignoring whitespace) is a key.
      let k = end;
      while (k < n && WHITESPACE.test(line[k])) k++;
      tokens.push({ text, kind: line[k] === ":" ? "key" : "string" });
      i = end;
    } else if (WHITESPACE.test(ch)) {
      let j = i;
      while (j < n && WHITESPACE.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), kind: "plain" });
      i = j;
    } else if (NUMBER_START.test(ch)) {
      let j = i + 1;
      while (j < n && NUMBER_BODY.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), kind: "number" });
      i = j;
    } else if (WORD.test(ch)) {
      let j = i;
      while (j < n && WORD.test(line[j])) j++;
      const word = line.slice(i, j);
      const isKeyword = word === "true" || word === "false" || word === "null";
      tokens.push({ text: word, kind: isKeyword ? "keyword" : "plain" });
      i = j;
    } else if (PUNCTUATION.includes(ch)) {
      tokens.push({ text: ch, kind: "punctuation" });
      i++;
    } else {
      tokens.push({ text: ch, kind: "plain" });
      i++;
    }
  }

  return tokens;
}
