import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KubeconfigTab } from "../KubeconfigTab";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock Tauri commands
const mockGetKubeconfigSources = jest.fn();
const mockListKubeconfigSources = jest.fn();
const mockAddKubeconfigSource = jest.fn();
const mockRemoveKubeconfigSource = jest.fn();
const mockSetKubeconfigMergeMode = jest.fn();

jest.mock("@/lib/tauri/commands", () => ({
  getKubeconfigSources: () => mockGetKubeconfigSources(),
  listKubeconfigSources: () => mockListKubeconfigSources(),
  addKubeconfigSource: (...args: unknown[]) => mockAddKubeconfigSource(...args),
  removeKubeconfigSource: (...args: unknown[]) =>
    mockRemoveKubeconfigSource(...args),
  setKubeconfigMergeMode: (...args: unknown[]) =>
    mockSetKubeconfigMergeMode(...args),
}));

// Mock cluster store
const mockFetchClusters = jest.fn();
jest.mock("@/lib/stores/cluster-store", () => ({
  useClusterStore: (selector: (s: { fetchClusters: jest.Mock }) => unknown) =>
    selector({ fetchClusters: mockFetchClusters }),
}));

const defaultConfig = {
  sources: [{ path: "/home/user/.kube/config", source_type: "file" }],
  merge_mode: false,
};

const defaultSourceInfos = [
  {
    path: "/home/user/.kube/config",
    source_type: "file",
    file_count: 1,
    context_count: 2,
    valid: true,
    error: null,
    is_default: true,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetKubeconfigSources.mockResolvedValue(defaultConfig);
  mockListKubeconfigSources.mockResolvedValue(defaultSourceInfos);
  mockFetchClusters.mockResolvedValue(undefined);
});

describe("KubeconfigTab", () => {
  it("renders sources list on mount", async () => {
    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(screen.getByText("/home/user/.kube/config")).toBeInTheDocument();
    });
  });

  it("shows file count and context count for valid sources", async () => {
    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(screen.getByText(/1/)).toBeInTheDocument();
      expect(screen.getByText(/2/)).toBeInTheDocument();
    });
  });

  it("hides delete button for default source", async () => {
    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(screen.getByText("/home/user/.kube/config")).toBeInTheDocument();
    });

    // No trash button should be rendered for is_default: true
    const trashButtons = screen.queryAllByRole("button").filter((btn) => {
      const svg = btn.querySelector("svg");
      return svg && btn.className.includes("ghost");
    });
    expect(trashButtons).toHaveLength(0);
  });

  it("shows delete button for non-default sources", async () => {
    const extraSource = {
      path: "/extra/kubeconfig.yaml",
      source_type: "file" as const,
      file_count: 1,
      context_count: 1,
      valid: true,
      error: null,
      is_default: false,
    };
    mockListKubeconfigSources.mockResolvedValue([
      ...defaultSourceInfos,
      extraSource,
    ]);

    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(screen.getByText("/extra/kubeconfig.yaml")).toBeInTheDocument();
    });

    // Find buttons that contain an SVG (icon-only buttons = delete buttons)
    const iconButtons = screen
      .queryAllByRole("button")
      .filter(
        (btn) => btn.querySelector("svg.lucide-trash-2") !== null
      );
    expect(iconButtons).toHaveLength(1);
  });

  it("shows delete confirmation dialog when clicking delete", async () => {
    const extraSource = {
      path: "/extra/kubeconfig.yaml",
      source_type: "file" as const,
      file_count: 1,
      context_count: 1,
      valid: true,
      error: null,
      is_default: false,
    };
    mockListKubeconfigSources.mockResolvedValue([
      ...defaultSourceInfos,
      extraSource,
    ]);

    const user = userEvent.setup();
    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(screen.getByText("/extra/kubeconfig.yaml")).toBeInTheDocument();
    });

    const deleteBtn = screen
      .queryAllByRole("button")
      .find((btn) => btn.querySelector("svg.lucide-trash-2") !== null)!;
    await user.click(deleteBtn);

    // Confirmation dialog should appear (AlertDialog renders in portal)
    await waitFor(() => {
      expect(
        screen.getByRole("alertdialog")
      ).toBeInTheDocument();
    });
  });

  it("shows error state for invalid sources", async () => {
    mockListKubeconfigSources.mockResolvedValue([
      {
        path: "/bad/path",
        source_type: "file",
        file_count: 0,
        context_count: 0,
        valid: false,
        error: "Path does not exist",
        is_default: false,
      },
    ]);

    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(screen.getByText("Path does not exist")).toBeInTheDocument();
    });
  });

  it("shows manual path input when enter path button is clicked", async () => {
    const user = userEvent.setup();
    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(
        screen.getByText("kubeconfig.sources.enterPath")
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("kubeconfig.sources.enterPath"));

    expect(
      screen.getByPlaceholderText("kubeconfig.sources.pathPlaceholder")
    ).toBeInTheDocument();
  });

  it("calls addKubeconfigSource when submitting manual path", async () => {
    mockAddKubeconfigSource.mockResolvedValue(defaultConfig);
    const user = userEvent.setup();
    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(
        screen.getByText("kubeconfig.sources.enterPath")
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("kubeconfig.sources.enterPath"));
    const input = screen.getByPlaceholderText(
      "kubeconfig.sources.pathPlaceholder"
    );
    await user.type(input, "/new/kubeconfig.yaml{Enter}");

    expect(mockAddKubeconfigSource).toHaveBeenCalledWith(
      "/new/kubeconfig.yaml",
      "file"
    );
  });

  it("toggles merge mode and refreshes clusters", async () => {
    mockSetKubeconfigMergeMode.mockResolvedValue({
      ...defaultConfig,
      merge_mode: true,
    });
    const user = userEvent.setup();
    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("switch"));

    expect(mockSetKubeconfigMergeMode).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(mockFetchClusters).toHaveBeenCalled();
    });
  });

  it("displays error when command fails", async () => {
    mockGetKubeconfigSources.mockRejectedValue(new Error("Store error"));

    render(<KubeconfigTab />);

    await waitFor(() => {
      expect(screen.getByText(/Store error/)).toBeInTheDocument();
    });
  });
});
