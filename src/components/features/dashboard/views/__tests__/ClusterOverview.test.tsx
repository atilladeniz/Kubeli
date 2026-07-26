import { fireEvent, render, screen } from "@testing-library/react";
import { ClusterOverview } from "../ClusterOverview";
import { useClusterMetrics } from "@/lib/hooks/useMetrics";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/lib/hooks/useK8sResources", () => ({
  usePods: () => ({ data: [] }),
  useDeployments: () => ({ data: [] }),
  useServices: () => ({ data: [] }),
  useNodes: () => ({ data: [] }),
}));

jest.mock("@/lib/hooks/useMetrics", () => ({
  useClusterMetrics: jest.fn(),
}));

const mockUseClusterMetrics = useClusterMetrics as jest.MockedFunction<
  typeof useClusterMetrics
>;

describe("ClusterOverview metrics refresh", () => {
  it("keeps manual refresh available after metrics loading fails", () => {
    const refresh = jest.fn();
    mockUseClusterMetrics.mockReturnValue({
      summary: null,
      metricsAvailable: false,
      isLoading: false,
      error: "Metrics server not available",
      refresh,
    });

    render(<ClusterOverview />);

    expect(screen.getByText("metrics.metricsNotAvailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "metrics.refresh" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
