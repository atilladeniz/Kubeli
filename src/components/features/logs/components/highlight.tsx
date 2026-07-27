import React from "react";
import { escapeRegExp } from "../lib";
import type { AnsiSegment, AnsiStyle } from "../lib/ansi";

/** Maximum query length for highlighting to prevent performance issues */
const MAX_HIGHLIGHT_QUERY_LENGTH = 200;

/**
 * Highlights matches in text using a regex pattern.
 */
export function highlightWithRegex(text: string, regex: RegExp): React.ReactNode {
  // The filter regex is deliberately non-global (.test() with "g" is stateful);
  // highlighting needs all occurrences, so build a local global copy. The
  // source already passed validateRegexSafety() in compileRegex (ReDoS check).
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const globalRegex = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : `${regex.flags}g`
  );
  // Slice by match indices instead of split(): split() with user capture
  // groups injects the captures into the parts array and corrupts the output.
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(globalRegex)) {
    if (match[0] === "") continue;
    const index = match.index ?? 0;
    result.push(text.slice(lastIndex, index));
    result.push(
      <mark key={key++} className="bg-yellow-500/30 text-yellow-200">
        {match[0]}
      </mark>
    );
    lastIndex = index + match[0].length;
  }
  result.push(text.slice(lastIndex));

  return result;
}

/**
 * Highlights matches in text using simple string matching.
 * Uses escapeRegExp to safely handle special characters in the query.
 * Query is length-limited to prevent ReDoS attacks.
 */
export function highlightWithString(text: string, query: string): React.ReactNode {
  // Prevent ReDoS by limiting query length
  if (!query || query.length > MAX_HIGHLIGHT_QUERY_LENGTH) {
    return text;
  }

  // escapeRegExp makes the pattern safe by escaping all special regex characters
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(regex);

  // split() with a capture group puts matches at odd indices; checking via
  // regex.test(part) on a global regex is stateful and skips every other match.
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-yellow-500/30 text-yellow-200">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Applies the active search highlight to a log message.
 * Returns the plain string when no search is active.
 */
export function highlightMessage(
  message: string,
  searchQuery: string,
  useRegex: boolean,
  searchRegex: RegExp | null
): React.ReactNode {
  if (!searchQuery) return message;
  if (useRegex && searchRegex) return highlightWithRegex(message, searchRegex);
  return highlightWithString(message, searchQuery);
}

/** Half-open [start, end) range of a search match within the message */
interface MatchRange {
  start: number;
  end: number;
}

/**
 * Collects search match ranges instead of slicing the string directly.
 *
 * ANSI styling and search highlighting both want to cut the same message on
 * different boundaries. Ranges let a single pass interleave the two.
 */
export function findMatchRanges(
  message: string,
  searchQuery: string,
  useRegex: boolean,
  searchRegex: RegExp | null
): MatchRange[] {
  if (!searchQuery) return [];

  const ranges: MatchRange[] = [];

  if (useRegex && searchRegex) {
    // See highlightWithRegex: the filter regex is non-global on purpose.
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    const globalRegex = new RegExp(
      searchRegex.source,
      searchRegex.flags.includes("g") ? searchRegex.flags : `${searchRegex.flags}g`
    );
    for (const match of message.matchAll(globalRegex)) {
      if (match[0] === "") continue;
      const start = match.index ?? 0;
      ranges.push({ start, end: start + match[0].length });
    }
    return ranges;
  }

  if (searchQuery.length > MAX_HIGHLIGHT_QUERY_LENGTH) return [];

  const lowerText = message.toLowerCase();
  const lowerQuery = searchQuery.toLowerCase();
  let index = lowerText.indexOf(lowerQuery);
  while (index !== -1) {
    ranges.push({ start: index, end: index + searchQuery.length });
    index = lowerText.indexOf(lowerQuery, index + searchQuery.length);
  }
  return ranges;
}

/**
 * Renders ANSI-styled segments with search matches marked inside them.
 *
 * Segment offsets and match ranges both index into the same ANSI-stripped
 * message, so a match spanning a color change is split across segments and
 * each part keeps its own styling.
 */
export function renderStyledSegments(
  segments: AnsiSegment[],
  matches: MatchRange[]
): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const segment of segments) {
    const segStart = segment.start;
    const segEnd = segStart + segment.text.length;
    const style = toCssStyle(segment.style);

    // Matches overlapping this segment, clipped to its bounds
    const local = matches
      .filter((m) => m.end > segStart && m.start < segEnd)
      .map((m) => ({
        start: Math.max(m.start, segStart) - segStart,
        end: Math.min(m.end, segEnd) - segStart,
      }));

    if (local.length === 0) {
      nodes.push(
        style ? (
          <span key={key++} style={style}>
            {segment.text}
          </span>
        ) : (
          segment.text
        )
      );
      continue;
    }

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (const m of local) {
      if (m.start > cursor) parts.push(segment.text.slice(cursor, m.start));
      parts.push(
        <mark key={key++} className="bg-yellow-500/30 text-yellow-200">
          {segment.text.slice(m.start, m.end)}
        </mark>
      );
      cursor = m.end;
    }
    if (cursor < segment.text.length) parts.push(segment.text.slice(cursor));

    nodes.push(
      style ? (
        <span key={key++} style={style}>
          {parts}
        </span>
      ) : (
        <React.Fragment key={key++}>{parts}</React.Fragment>
      )
    );
  }

  return nodes;
}

/** Maps parsed ANSI attributes to a React style object, or undefined if empty */
function toCssStyle(style: AnsiStyle): React.CSSProperties | undefined {
  const hasAny =
    style.color ||
    style.backgroundColor ||
    style.fontWeight ||
    style.fontStyle ||
    style.textDecoration ||
    style.opacity !== undefined;
  return hasAny ? (style as React.CSSProperties) : undefined;
}
