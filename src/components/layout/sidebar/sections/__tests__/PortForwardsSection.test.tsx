import { render, screen } from "@testing-library/react";
import { PortForwardsSection } from "../PortForwardsSection";
import type { PortForwardInfo } from "@/lib/types";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const forward: PortForwardInfo = {
  forward_id: "pod-demo-web-80-1",
  cluster_context: "cluster-a",
  namespace: "demo",
  name: "web",
  target_type: "pod",
  target_port: 80,
  local_port: 8080,
  status: "connected",
  pod_name: undefined,
  pod_uid: undefined,
  requested_port: 80,
  port_name: undefined,
};

function renderSection(props: {
  isConnected?: boolean;
  forwards?: PortForwardInfo[];
  otherClusterCount?: number;
}) {
  return render(
    <PortForwardsSection
      isConnected={props.isConnected ?? true}
      forwards={props.forwards ?? []}
      otherClusterCount={props.otherClusterCount ?? 0}
      isPortForwardsSectionOpen={true}
      setIsPortForwardsSectionOpen={jest.fn()}
      onResourceSelect={jest.fn()}
      onOpenForwardInBrowser={jest.fn()}
      stopForward={jest.fn()}
    />
  );
}

describe("PortForwardsSection", () => {
  it("renders nothing when no cluster has forwards", () => {
    const { container } = renderSection({ forwards: [], otherClusterCount: 0 });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when disconnected", () => {
    const { container } = renderSection({
      isConnected: false,
      forwards: [forward],
      otherClusterCount: 2,
    });
    expect(container).toBeEmptyDOMElement();
  });

  // Regression: the section returned null whenever the ACTIVE cluster had no
  // forwards, hiding the all-clusters link exactly when forwards survived
  // only on other clusters - the one case the link exists for.
  it("keeps the all-clusters link visible when only other clusters have forwards", () => {
    renderSection({ forwards: [], otherClusterCount: 2 });
    expect(
      screen.getByRole("button", { name: /portForwardsAllOther/ })
    ).toBeInTheDocument();
  });

  it("shows current forwards and the all-clusters link together", () => {
    renderSection({ forwards: [forward], otherClusterCount: 1 });
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /portForwardsAllOther/ })
    ).toBeInTheDocument();
  });

  it("hides the all-clusters link when no other cluster has forwards", () => {
    renderSection({ forwards: [forward], otherClusterCount: 0 });
    expect(
      screen.queryByRole("button", { name: /portForwardsAllOther/ })
    ).not.toBeInTheDocument();
  });
});
