import { render, screen } from "@testing-library/react";
import { ClusterGridCard } from "../ClusterGridCard";
import type { Cluster } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const cluster = (overrides: Partial<Cluster> = {}): Cluster => ({
  id: "kubeli-eks-demo",
  name: "kubeli-eks-demo",
  context: "arn:aws:eks:us-west-2:123456789012:cluster/kubeli-eks-demo",
  server: "https://ABC1234567890ABCDEF1234567890AB.gr7.us-west-2.eks.amazonaws.com",
  namespace: "kubeli-demo",
  user: "eks-user",
  auth_type: "exec",
  current: false,
  source_file: null,
  ...overrides,
});

const props = {
  isActive: false,
  isConnecting: false,
  disabled: false,
  onConnect: jest.fn(),
  onCancelConnect: jest.fn(),
  onConfigureNamespaces: jest.fn(),
  forwardsCount: 0,
  hasConfiguredNamespaces: false,
};

/**
 * A long EKS context used to widen the card past its grid track: the truncate
 * classes could not take effect because CardHeader is a grid and CardContent a
 * flex column, whose items default to min-width:auto.
 */
describe("ClusterGridCard overflow", () => {
  it("lets every wrapper around the truncated context shrink", () => {
    const { container } = render(<ClusterGridCard cluster={cluster()} {...props} />);

    const context = screen.getByText(cluster().context);
    expect(context.className).toContain("truncate");

    // Walk up to the card and require min-w-0 on each block-level wrapper
    const card = container.firstElementChild as HTMLElement;
    let node: HTMLElement | null = context;
    const missing: string[] = [];
    while (node && node !== card.parentElement) {
      const className = node.className.toString();
      const shrinkable =
        className.includes("min-w-0") || className.includes("truncate");
      if (!shrinkable) missing.push(className || node.tagName);
      node = node.parentElement;
    }

    expect(missing).toEqual([]);
  });

  it("gives the long values a tooltip so the cut-off text stays readable", () => {
    render(<ClusterGridCard cluster={cluster()} {...props} />);

    expect(screen.getByText(cluster().context)).toHaveAttribute("title", cluster().context);
    expect(screen.getByText(cluster().server)).toHaveAttribute("title", cluster().server);
  });

  it("still renders the name, server and connect action", () => {
    render(<ClusterGridCard cluster={cluster()} {...props} />);

    expect(screen.getByText("kubeli-eks-demo")).toBeInTheDocument();
    expect(screen.getByText(cluster().server)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "connect" })).toBeInTheDocument();
  });
});
