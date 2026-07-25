import { render, screen } from "@testing-library/react";
import { fluxKustomizationColumns, helmReleaseColumns } from "../extensions";
import type { FluxKustomizationInfo, HelmReleaseInfo } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const kustomization = (suspended: boolean): FluxKustomizationInfo => ({
  name: "apps",
  namespace: "flux-system",
  path: "./apps",
  source_ref: "GitRepository/flux-system",
  interval: "10m",
  status: "ready",
  suspended,
  message: null,
  last_applied_revision: null,
  created_at: null,
});

const release = (suspended: boolean): HelmReleaseInfo => ({
  name: "podinfo",
  namespace: "default",
  revision: 1,
  status: "deployed",
  chart: "podinfo",
  chart_version: "6.5.0",
  app_version: "6.5.0",
  first_deployed: null,
  last_deployed: null,
  description: "",
  notes: null,
  managed_by: "flux",
  suspended,
});

const statusCell = <T,>(columns: { key: string; render?: (item: T) => React.ReactNode }[], item: T) =>
  columns.find((c) => c.key === "status")!.render!(item);

describe("Flux status column", () => {
  // Suspend doesn't change the Ready/Helm status, so the badge must
  // surface the suspended flag explicitly
  it("shows Suspended instead of the stale status for a paused kustomization", () => {
    render(<>{statusCell(fluxKustomizationColumns, kustomization(true))}</>);
    expect(screen.getByText("suspended")).toBeInTheDocument();
    expect(screen.queryByText("ready")).not.toBeInTheDocument();
  });

  it("shows the regular status for an active kustomization", () => {
    render(<>{statusCell(fluxKustomizationColumns, kustomization(false))}</>);
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("shows Suspended for a paused HelmRelease", () => {
    render(<>{statusCell(helmReleaseColumns, release(true))}</>);
    expect(screen.getByText("suspended")).toBeInTheDocument();
  });

  it("shows the Helm status for an active HelmRelease", () => {
    render(<>{statusCell(helmReleaseColumns, release(false))}</>);
    expect(screen.queryByText("suspended")).not.toBeInTheDocument();
  });
});
