/**
 * Lightweight line-level diff with word-level intra-line highlighting.
 *
 * Built for small text blobs (a few KB) such as ArgoCD source specs, where a
 * full Monaco editor is unnecessary overhead. Uses an O(n*m) LCS — fine for the
 * sizes involved and far cheaper to mount than an embedded editor.
 */

export interface DiffSegment {
  text: string;
  changed: boolean;
}

export type DiffCellType = "equal" | "added" | "removed";

export interface DiffCell {
  lineNumber: number;
  segments: DiffSegment[];
  type: DiffCellType;
}

export interface DiffRow {
  left: DiffCell | null;
  right: DiffCell | null;
}

export interface DiffStats {
  additions: number;
  deletions: number;
}

export interface SideBySideDiff {
  rows: DiffRow[];
  stats: DiffStats;
}

type Op<T> =
  | { kind: "equal"; left: T; right: T }
  | { kind: "del"; left: T }
  | { kind: "ins"; right: T };

/** Longest-common-subsequence diff over two sequences. */
function diffSequence<T>(a: T[], b: T[]): Op<T>[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: Op<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "equal", left: a[i], right: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "del", left: a[i] });
      i++;
    } else {
      ops.push({ kind: "ins", right: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ kind: "del", left: a[i++] });
  while (j < m) ops.push({ kind: "ins", right: b[j++] });
  return ops;
}

/** Split into tokens while preserving whitespace runs as their own tokens. */
function tokenize(line: string): string[] {
  return line.match(/\s+|[^\s]+/g) ?? [];
}

/** Collapse adjacent segments that share the same changed flag. */
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const seg of segments) {
    if (seg.text === "") continue;
    const last = out[out.length - 1];
    if (last && last.changed === seg.changed) {
      last.text += seg.text;
    } else {
      out.push({ ...seg });
    }
  }
  return out.length > 0 ? out : [{ text: "", changed: false }];
}

/** Word-level diff between a removed line and its paired added line. */
function diffWords(
  oldLine: string,
  newLine: string,
): [DiffSegment[], DiffSegment[]] {
  const ops = diffSequence(tokenize(oldLine), tokenize(newLine));
  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];
  for (const op of ops) {
    if (op.kind === "equal") {
      left.push({ text: op.left, changed: false });
      right.push({ text: op.right, changed: false });
    } else if (op.kind === "del") {
      left.push({ text: op.left, changed: true });
    } else {
      right.push({ text: op.right, changed: true });
    }
  }
  return [mergeSegments(left), mergeSegments(right)];
}

/**
 * Produce an aligned side-by-side diff. Consecutive removed/added lines are
 * paired row-by-row so modified lines line up, with word-level highlighting on
 * the paired changes.
 */
export function computeSideBySideDiff(
  oldText: string,
  newText: string,
): SideBySideDiff {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const ops = diffSequence(a, b);

  const rows: DiffRow[] = [];
  let leftNum = 0;
  let rightNum = 0;
  let additions = 0;
  let deletions = 0;

  let pendingDel: string[] = [];
  let pendingIns: string[] = [];

  const flush = () => {
    const max = Math.max(pendingDel.length, pendingIns.length);
    for (let k = 0; k < max; k++) {
      const l = k < pendingDel.length ? pendingDel[k] : undefined;
      const r = k < pendingIns.length ? pendingIns[k] : undefined;
      let left: DiffCell | null = null;
      let right: DiffCell | null = null;

      if (l !== undefined && r !== undefined) {
        // Modified pair: highlight only the words that actually differ.
        const [ls, rs] = diffWords(l, r);
        left = { lineNumber: ++leftNum, segments: ls, type: "removed" };
        right = { lineNumber: ++rightNum, segments: rs, type: "added" };
      } else if (l !== undefined) {
        // Pure removal: the line background carries the signal, no word pill.
        left = {
          lineNumber: ++leftNum,
          segments: [{ text: l, changed: false }],
          type: "removed",
        };
      } else if (r !== undefined) {
        // Pure addition: line background only, no word pill.
        right = {
          lineNumber: ++rightNum,
          segments: [{ text: r, changed: false }],
          type: "added",
        };
      }

      if (l !== undefined) deletions++;
      if (r !== undefined) additions++;
      rows.push({ left, right });
    }
    pendingDel = [];
    pendingIns = [];
  };

  for (const op of ops) {
    if (op.kind === "equal") {
      flush();
      rows.push({
        left: {
          lineNumber: ++leftNum,
          segments: [{ text: op.left, changed: false }],
          type: "equal",
        },
        right: {
          lineNumber: ++rightNum,
          segments: [{ text: op.right, changed: false }],
          type: "equal",
        },
      });
    } else if (op.kind === "del") {
      pendingDel.push(op.left);
    } else {
      pendingIns.push(op.right);
    }
  }
  flush();

  return { rows, stats: { additions, deletions } };
}
