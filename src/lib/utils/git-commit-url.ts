/**
 * Build a browser URL for a specific commit in a git repository, so revision
 * SHAs in the ArgoCD history can link out to the hosted source.
 *
 * Supports the common hosted providers (GitHub, GitLab, Bitbucket, Azure
 * DevOps) and normalizes `git@host:org/repo.git` / `*.git` forms. Returns null
 * when the inputs can't form a sensible https URL, so callers can fall back to
 * plain text.
 */
export function gitCommitUrl(
  repoUrl: string,
  revision: string,
): string | null {
  const repo = repoUrl?.trim();
  const rev = revision?.trim();
  // Only link full commit SHAs, not branch/tag names like "main" or "v1.0.0".
  if (!repo || !/^[0-9a-f]{7,40}$/i.test(rev)) return null;

  const base = normalizeRepoUrl(repo);
  if (!base) return null;

  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    return null;
  }

  if (host.includes("bitbucket")) return `${base}/commits/${rev}`;
  if (host.includes("dev.azure.com") || host.includes("visualstudio.com")) {
    return `${base}/commit/${rev}`;
  }
  // GitHub, GitLab and most others use /commit/<sha>.
  return `${base}/commit/${rev}`;
}

/** Normalize a repo URL to an https base without a trailing `.git`. */
function normalizeRepoUrl(repoUrl: string): string | null {
  let url = repoUrl;

  // scp-like syntax: git@github.com:org/repo.git -> https://github.com/org/repo
  const scp = url.match(/^[^@]+@([^:]+):(.+)$/);
  if (scp) url = `https://${scp[1]}/${scp[2]}`;

  url = url.replace(/^ssh:\/\//, "https://").replace(/^git:\/\//, "https://");
  url = url.replace(/\.git$/, "").replace(/\/+$/, "");

  if (!/^https?:\/\//.test(url)) return null;
  return url;
}
