import { useEffect, useState } from "react";
import type { AiCliProvider } from "@/lib/stores/ui-store";
import { aiListModels, type AiModelCatalog } from "@/lib/tauri/commands/ai";

const ALL_PROVIDERS: AiCliProvider[] = ["claude", "codex", "opencode", "droid"];
const EMPTY: AiModelCatalog = {
  models: [],
  defaultModel: null,
  defaultEffort: null,
};

// ponytail: module cache, one CLI call per provider per app run. A failed
// load is dropped so the next open retries.
const cache = new Map<AiCliProvider, Promise<AiModelCatalog>>();

function loadCatalog(provider: AiCliProvider): Promise<AiModelCatalog> {
  let pending = cache.get(provider);
  if (!pending) {
    pending = aiListModels(provider).catch(() => {
      cache.delete(provider);
      return EMPTY;
    });
    cache.set(provider, pending);
  }
  return pending;
}

/** Load every provider's catalog up front so the composer menus open filled. */
export function preloadModelCatalogs() {
  ALL_PROVIDERS.forEach((provider) => void loadCatalog(provider));
}

/** The provider's model catalog, or `null` while it is loading. */
export function useModelCatalog(
  provider: AiCliProvider,
): AiModelCatalog | null {
  const [loaded, setLoaded] = useState<{
    provider: AiCliProvider;
    catalog: AiModelCatalog;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    loadCatalog(provider).then((catalog) => {
      if (alive) setLoaded({ provider, catalog });
    });
    return () => {
      alive = false;
    };
  }, [provider]);
  // A catalog loaded for a previous provider counts as still loading.
  return loaded?.provider === provider ? loaded.catalog : null;
}
