/**
 * Regression: settings persisted by an older version must get defaults for
 * newer fields on the very first (synchronous) hydration at module load.
 * The old onRehydrateStorage callback called useUIStore.setState before the
 * store existed, so fields like metricsRefreshInterval stayed undefined and
 * Settings > General crashed on `.toString()`.
 */
describe("ui-store hydration at module load", () => {
  afterEach(() => localStorage.clear());

  const loadStore = () => {
    let store!: typeof import("../ui-store");
    jest.isolateModules(() => {
      store = jest.requireActual("../ui-store");
    });
    return store;
  };

  it("fills fields missing from an old persisted store with defaults", () => {
    localStorage.setItem(
      "kubeli-ui-settings",
      JSON.stringify({ state: { settings: { theme: "light", refreshInterval: 60 } }, version: 0 }),
    );

    const { useUIStore, defaultSettings } = loadStore();
    const { settings, resolvedTheme } = useUIStore.getState();

    expect(settings.metricsRefreshInterval).toBe(defaultSettings.metricsRefreshInterval);
    expect(settings.refreshInterval).toBe(60);
    expect(settings.theme).toBe("light");
    expect(resolvedTheme).toBe("light");
  });

  it("repairs invalid persisted values", () => {
    localStorage.setItem(
      "kubeli-ui-settings",
      JSON.stringify({
        state: { settings: { locale: "xx", vibrancyLevel: "bogus", clusterViewLayout: "table" } },
        version: 0,
      }),
    );

    const { useUIStore, defaultSettings } = loadStore();
    const { settings } = useUIStore.getState();

    expect(settings.locale).toBe(defaultSettings.locale);
    expect(settings.vibrancyLevel).toBe(defaultSettings.vibrancyLevel);
    expect(settings.clusterViewLayout).toBe("grid");
  });
});
