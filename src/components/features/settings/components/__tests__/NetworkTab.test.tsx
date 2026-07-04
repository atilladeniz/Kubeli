import { render, waitFor } from "@testing-library/react";
import { NetworkTab } from "../NetworkTab";
import { useUIStore } from "@/lib/stores/ui-store";
import { act } from "react";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockApplyProxyFromSettings = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/tauri/commands/network", () => ({
  applyProxyFromSettings: (...args: unknown[]) =>
    mockApplyProxyFromSettings(...args),
}));

describe("NetworkTab", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockApplyProxyFromSettings.mockClear();
    act(() => {
      useUIStore.getState().updateSettings({
        proxyType: "none",
        proxyHost: "",
        proxyPort: 8080,
        proxyUsername: "",
        proxyPassword: "",
      });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not push the initial (unchanged) settings to the backend", () => {
    render(<NetworkTab />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockApplyProxyFromSettings).not.toHaveBeenCalled();
  });

  // Regression: the proxy UI only wrote to the UI store and never invoked
  // set_proxy_config, so proxy settings had no effect on connections.
  it("pushes proxy changes to the backend (debounced)", async () => {
    render(<NetworkTab />);

    act(() => {
      useUIStore.getState().updateSettings({
        proxyType: "http",
        proxyHost: "proxy.local",
        proxyPort: 3128,
      });
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() =>
      expect(mockApplyProxyFromSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          proxyType: "http",
          proxyHost: "proxy.local",
          proxyPort: 3128,
        })
      )
    );
  });
});
