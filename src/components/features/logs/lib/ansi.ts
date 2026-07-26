/**
 * Minimal ANSI SGR (Select Graphic Rendition) parser for log rendering.
 *
 * Only the escape sequences that actually show up in container logs are
 * handled: colors (16 / 256 / truecolor), bold, dim, italic, underline and
 * strikethrough. Cursor movement, scrolling and other control sequences are
 * stripped rather than interpreted — a log viewer has no cursor to move.
 */

/**
 * Matches any CSI sequence: parameter bytes, optional intermediate bytes and
 * one final byte. This includes private modes such as \x1b[?25l and
 * non-letter final bytes such as \x1b[1~.
 */
// eslint-disable-next-line no-control-regex
const CSI_PATTERN = /\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g;

/** Matches OSC sequences terminated by BEL or ST, e.g. terminal hyperlinks */
// eslint-disable-next-line no-control-regex
const OSC_PATTERN = /\x1b\](?:[^\x07\x1b]|\x1b(?!\\))*(?:\x07|\x1b\\|$)/g;

/** Matches SGR sequences specifically (CSI ... m) */
// eslint-disable-next-line no-control-regex
const SGR_PATTERN = /\x1b\[([0-9;:]*)m/;

/** Cheap pre-check so log lines without escapes skip parsing entirely */
// eslint-disable-next-line no-control-regex
const HAS_ESCAPE = /\x1b(?:\[|\])/;

export interface AnsiStyle {
  color?: string;
  backgroundColor?: string;
  fontWeight?: "bold";
  fontStyle?: "italic";
  textDecoration?: string;
  opacity?: number;
}

export interface AnsiSegment {
  text: string;
  style: AnsiStyle;
  /** Offset of this segment's text within the stripped message */
  start: number;
}

/**
 * The standard 16 colors, as CSS variables would be overkill here. Values are
 * picked to stay legible on both light and dark backgrounds — terminal-default
 * bright red on white is unreadable.
 */
const BASE_COLORS = [
  "#000000", "#cd3131", "#0dbc79", "#e5e510",
  "#2472c8", "#bc3fbc", "#11a8cd", "#e5e5e5",
] as const;

const BRIGHT_COLORS = [
  "#666666", "#f14c4c", "#23d18b", "#f5f543",
  "#3b8eea", "#d670d6", "#29b8db", "#ffffff",
] as const;

/** Resolves a 256-color palette index to a CSS color */
function color256(index: number): string {
  if (index < 8) return BASE_COLORS[index];
  if (index < 16) return BRIGHT_COLORS[index - 8];
  if (index < 232) {
    // 6x6x6 color cube
    const n = index - 16;
    const levels = [0, 95, 135, 175, 215, 255];
    const r = levels[Math.floor(n / 36) % 6];
    const g = levels[Math.floor(n / 6) % 6];
    const b = levels[n % 6];
    return `rgb(${r}, ${g}, ${b})`;
  }
  // Grayscale ramp
  const gray = 8 + (index - 232) * 10;
  return `rgb(${gray}, ${gray}, ${gray})`;
}

/**
 * Consumes an extended color sequence (38/48) starting at `i`, which is the
 * index of the 38 or 48 itself. Returns the color and how many params it ate.
 *
 * Supports both `38;5;n` (256-color) and `38;2;r;g;b` (truecolor).
 */
function readExtendedColor(params: number[], i: number): { color?: string; consumed: number } {
  const mode = params[i + 1];
  if (mode === 5 && params.length > i + 2) {
    return { color: color256(params[i + 2]), consumed: 2 };
  }
  if (mode === 2 && params.length > i + 4) {
    const [r, g, b] = [params[i + 2], params[i + 3], params[i + 4]];
    return { color: `rgb(${r}, ${g}, ${b})`, consumed: 4 };
  }
  // Malformed — swallow the mode byte so it isn't read as another attribute
  return { consumed: 1 };
}

/** Applies one SGR parameter list to a style, returning the new style */
function applySgr(style: AnsiStyle, params: number[]): AnsiStyle {
  let next: AnsiStyle = { ...style };

  for (let i = 0; i < params.length; i++) {
    const code = params[i];

    if (code === 0) {
      next = {};
    } else if (code === 1) {
      next.fontWeight = "bold";
    } else if (code === 2) {
      next.opacity = 0.6;
    } else if (code === 3) {
      next.fontStyle = "italic";
    } else if (code === 4) {
      next.textDecoration = "underline";
    } else if (code === 9) {
      next.textDecoration = "line-through";
    } else if (code === 22) {
      delete next.fontWeight;
      delete next.opacity;
    } else if (code === 23) {
      delete next.fontStyle;
    } else if (code === 24 || code === 29) {
      delete next.textDecoration;
    } else if (code >= 30 && code <= 37) {
      next.color = BASE_COLORS[code - 30];
    } else if (code === 38) {
      const { color, consumed } = readExtendedColor(params, i);
      if (color) next.color = color;
      i += consumed;
    } else if (code === 39) {
      delete next.color;
    } else if (code >= 40 && code <= 47) {
      next.backgroundColor = BASE_COLORS[code - 40];
    } else if (code === 48) {
      const { color, consumed } = readExtendedColor(params, i);
      if (color) next.backgroundColor = color;
      i += consumed;
    } else if (code === 49) {
      delete next.backgroundColor;
    } else if (code >= 90 && code <= 97) {
      next.color = BRIGHT_COLORS[code - 90];
    } else if (code >= 100 && code <= 107) {
      next.backgroundColor = BRIGHT_COLORS[code - 100];
    }
    // Unknown codes are ignored rather than dropped mid-line
  }

  return next;
}

/** True if the text contains any ANSI escape sequence */
export function hasAnsiCodes(text: string): boolean {
  return HAS_ESCAPE.test(text);
}

/**
 * Removes all ANSI escape sequences.
 *
 * Applied at ingest so that search, level detection, export and the AI prompt
 * all operate on clean text — only rendering cares about the codes.
 */
export function stripAnsi(text: string): string {
  if (!hasAnsiCodes(text)) return text;
  return text.replace(OSC_PATTERN, "").replace(CSI_PATTERN, "");
}

/**
 * Splits text into styled segments, with offsets relative to the ANSI-stripped
 * text. Those offsets are what let search highlighting — which works on the
 * stripped message — line up with the styling.
 */
export function parseAnsi(text: string): AnsiSegment[] {
  if (!hasAnsiCodes(text)) {
    return [{ text, style: {}, start: 0 }];
  }

  const sanitizedText = text.replace(OSC_PATTERN, "");
  const segments: AnsiSegment[] = [];
  let style: AnsiStyle = {};
  let buffer = "";
  let bufferStart = 0;
  let plainLength = 0;
  let rest = sanitizedText;

  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer, style, start: bufferStart });
      buffer = "";
    }
  };

  while (rest.length > 0) {
    const match = CSI_PATTERN.exec(rest);
    CSI_PATTERN.lastIndex = 0;

    if (!match) {
      buffer += rest;
      plainLength += rest.length;
      break;
    }

    const before = rest.slice(0, match.index);
    if (before) {
      buffer += before;
      plainLength += before.length;
    }

    const sgr = SGR_PATTERN.exec(match[0]);
    if (sgr) {
      // A style change ends the current run
      flush();
      bufferStart = plainLength;
      // "\x1b[m" is shorthand for a full reset
      const params = sgr[1]
        ? sgr[1].split(/[;:]/).map((p) => (p === "" ? 0 : Number(p)))
        : [0];
      style = applySgr(style, params);
    }
    // Non-SGR sequences (cursor moves, erases) are simply dropped

    rest = rest.slice(match.index + match[0].length);
  }

  flush();
  return segments.length > 0 ? segments : [{ text: "", style: {}, start: 0 }];
}
