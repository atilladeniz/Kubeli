async function loadCoreModule(options: {
  mockMode?: boolean;
  tauriResult?: unknown;
  tauriError?: unknown;
  mockResult?: unknown;
  wrappedError?: unknown;
}) {
  jest.resetModules();

  if (options.mockMode) {
    process.env.VITE_TAURI_MOCK = "true";
  } else {
    delete process.env.VITE_TAURI_MOCK;
  }

  const tauriInvoke = jest.fn();
  const mockInvoke = jest.fn();
  const toKubeliError = jest.fn((value) => value);

  if (options.tauriError !== undefined) {
    tauriInvoke.mockRejectedValue(options.tauriError);
  } else {
    tauriInvoke.mockResolvedValue(options.tauriResult);
  }
  mockInvoke.mockResolvedValue(options.mockResult);
  toKubeliError.mockReturnValue(options.wrappedError);

  jest.doMock("@tauri-apps/api/core", () => ({ invoke: tauriInvoke }));
  jest.doMock("../../mock", () => ({ mockInvoke }));
  jest.doMock("../../../types/errors", () => ({ toKubeliError }));

  const mod = await import("../core");
  return { ...mod, tauriInvoke, mockInvoke, toKubeliError };
}

describe("tauri core invoke", () => {
  afterEach(() => {
    delete process.env.VITE_TAURI_MOCK;
  });

  it("uses mockInvoke when Tauri mock mode is enabled", async () => {
    const core = await loadCoreModule({ mockMode: true, mockResult: { ok: true } });

    await expect(core.invoke("list_clusters", { context: "demo" })).resolves.toEqual({
      ok: true,
    });
    expect(core.mockInvoke).toHaveBeenCalledWith("list_clusters", { context: "demo" });
    expect(core.tauriInvoke).not.toHaveBeenCalled();
  });

  it("delegates to tauriInvoke when mock mode is disabled", async () => {
    const core = await loadCoreModule({ tauriResult: ["ok"] });

    await expect(core.invoke("list_pods", { options: {} })).resolves.toEqual(["ok"]);
    expect(core.tauriInvoke).toHaveBeenCalledWith("list_pods", { options: {} });
  });

  it("normalizes tauri errors with toKubeliError", async () => {
    const wrapped = { kind: "Unknown", message: "wrapped" };
    const core = await loadCoreModule({
      tauriError: new Error("boom"),
      wrappedError: wrapped,
    });

    await expect(core.invoke("explode")).rejects.toEqual(wrapped);
    expect(core.toKubeliError).toHaveBeenCalled();
  });
});
