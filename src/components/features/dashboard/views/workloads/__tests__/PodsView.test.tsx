import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PodsView } from "../PodsView";
import { usePods, useServices } from "@/lib/hooks/useK8sResources";
import { usePodMetrics } from "@/lib/hooks/useMetrics";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/lib/hooks/useK8sResources", () => ({
  usePods: jest.fn(),
  useServices: jest.fn(),
}));

jest.mock("@/lib/hooks/useMetrics", () => ({
  usePodMetrics: jest.fn(),
}));

jest.mock("@/components/features/resources/ResourceList", () => ({
  ResourceList: ({ onRefresh }: { onRefresh: () => Promise<void> }) => (
    <button onClick={() => void onRefresh()}>refresh pods</button>
  ),
}));

jest.mock("@/components/features/resources/columns", () => ({
  getPodColumnsWithMetrics: () => [],
  translateColumns: (columns: unknown[]) => columns,
  getEffectivePodStatus: () => "Running",
}));

jest.mock("@/lib/hooks/usePortForward", () => ({
  usePortForward: () => ({
    forwards: [],
    requestForward: jest.fn(),
    stopForward: jest.fn(),
  }),
}));

jest.mock("@/components/features/terminal", () => ({
  useTerminalTabs: () => ({ addTab: jest.fn() }),
}));

jest.mock("@/components/features/dashboard/context", () => ({
  useResourceDetail: () => ({
    openResourceDetail: jest.fn(),
    handleDeleteFromContext: jest.fn(),
    closeResourceDetail: jest.fn(),
  }),
}));

jest.mock("@/lib/hooks/useRefreshOnDelete", () => ({
  useRefreshOnDelete: jest.fn(),
}));

jest.mock("@/lib/stores/cluster-store", () => ({
  useClusterStore: (selector: (state: unknown) => unknown) =>
    selector({ currentCluster: { context: "test" } }),
}));

jest.mock("@/lib/stores/favorites-store", () => ({
  useFavoritesStore: (selector: (state: unknown) => unknown) =>
    selector({
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
      isFavorite: jest.fn(() => false),
    }),
}));

jest.mock("@/lib/stores/ui-store", () => ({
  useUIStore: (selector: (state: unknown) => unknown) =>
    selector({ pendingPodLogs: null, setPendingPodLogs: jest.fn() }),
}));

jest.mock("@/lib/stores/tabs-store", () => ({
  useTabsStore: (selector: (state: unknown) => unknown) =>
    selector({ openOrActivateTab: jest.fn() }),
}));

jest.mock("@/lib/hooks/useMetricsHistory", () => ({
  seedHistoryFromBulkMetrics: jest.fn(),
}));

const mockUsePods = usePods as jest.MockedFunction<typeof usePods>;
const mockUseServices = useServices as jest.MockedFunction<typeof useServices>;
const mockUsePodMetrics = usePodMetrics as jest.MockedFunction<
  typeof usePodMetrics
>;

describe("PodsView refresh", () => {
  it("refreshes pod data and metrics from the manual refresh action", async () => {
    const refreshPods = jest.fn().mockResolvedValue(undefined);
    const refreshMetrics = jest.fn().mockResolvedValue(undefined);
    mockUsePods.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refresh: refreshPods,
      retry: jest.fn(),
      startWatch: jest.fn(),
      stopWatchFn: jest.fn(),
      isWatching: false,
    } as ReturnType<typeof usePods>);
    mockUseServices.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      retry: jest.fn(),
      startWatch: jest.fn(),
      stopWatchFn: jest.fn(),
      isWatching: false,
    });
    mockUsePodMetrics.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refresh: refreshMetrics,
    });

    render(<PodsView />);
    fireEvent.click(screen.getByRole("button", { name: "refresh pods" }));

    await waitFor(() => {
      expect(refreshPods).toHaveBeenCalledTimes(1);
      expect(refreshMetrics).toHaveBeenCalledTimes(1);
    });
  });
});
