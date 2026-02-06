import { render, screen } from "@testing-library/react";
import Home from "../../App";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/lib/stores/cluster-store", () => ({
  useClusterStore: () => ({
    clusters: [],
    currentCluster: null,
    isConnected: false,
    isLoading: false,
    error: null,
    fetchClusters: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(),
    lastConnectionErrorContext: null,
    lastConnectionErrorMessage: null,
  }),
}));

jest.mock("@/lib/stores/ui-store", () => ({
  useUIStore: () => ({
    setSettingsOpen: jest.fn(),
  }),
}));

jest.mock("@/lib/hooks/usePortForward", () => ({
  usePortForward: () => ({
    forwards: [],
  }),
}));

jest.mock("@/lib/hooks/useKubeconfigWatcher", () => ({
  useKubeconfigWatcher: () => ({
    restartWatcher: jest.fn(),
  }),
}));

jest.mock("@/lib/hooks/useUpdater", () => ({
  useUpdater: () => ({
    available: false,
    update: null,
    downloading: false,
    progress: null,
    readyToRestart: false,
    downloadComplete: false,
    downloadAndInstall: jest.fn(),
    restartNow: jest.fn(),
  }),
}));

jest.mock("@/components/features/dashboard", () => ({
  Dashboard: () => <div>Dashboard</div>,
}));

jest.mock("@/components/features/settings/SettingsPanel", () => ({
  SettingsPanel: () => <div>SettingsPanel</div>,
}));

jest.mock("@/components/features/updates/RestartDialog", () => ({
  RestartDialog: () => <div>RestartDialog</div>,
}));

jest.mock("@/lib/tauri/commands", () => ({
  generateDebugLog: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Home", () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__TAURI__;
  });

  it("shows the empty cluster state in Tauri mode", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI__ = {};

    render(<Home />);

    expect(await screen.findByText("noClusters")).toBeInTheDocument();
  });
});
