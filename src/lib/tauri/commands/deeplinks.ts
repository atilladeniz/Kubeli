import { invoke } from "./core";

/**
 * A deep link the backend resolved into an action. Mirrors the `DeepLinkAction`
 * enum in `src-tauri/src/app/setup/deep_links.rs` (serde tag = "kind").
 */
export type DeepLinkAction =
  | { kind: "navigate"; view: string }
  | { kind: "connect"; context: string }
  | { kind: "oidc_callback"; code: string; state: string };

/**
 * Drain deep links that arrived during a cold start, before the frontend's
 * `navigate`/`auto-connect` listeners were mounted. Returns and clears the
 * backend buffer, so a second call yields an empty list.
 */
export async function takeStartupDeepLinks(): Promise<DeepLinkAction[]> {
  return invoke<DeepLinkAction[]>("take_startup_deep_links");
}
