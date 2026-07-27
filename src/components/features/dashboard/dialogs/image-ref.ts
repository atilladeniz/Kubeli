/**
 * Splits an image reference into repository and tag.
 *
 * A colon only starts the tag when it comes after the last slash — otherwise
 * it is a registry port, as in `registry.local:5000/app`.
 */
export function splitImageRef(image: string): { repository: string; tag: string } {
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  if (lastColon > lastSlash) {
    return { repository: image.slice(0, lastColon), tag: image.slice(lastColon + 1) };
  }
  return { repository: image, tag: "" };
}

/** Rejoins repository and tag, omitting the separator when there is no tag */
export function joinImageRef(repository: string, tag: string): string {
  const repo = repository.trim();
  const trimmedTag = tag.trim();
  return trimmedTag ? `${repo}:${trimmedTag}` : repo;
}
