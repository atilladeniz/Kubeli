import { render, screen } from "@testing-library/react";
import { ContainerStatusSection, isBenignTermination } from "../ContainerStatusSection";
import type { ContainerInfo } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/lib/tauri/commands", () => ({
  revealEnvVar: jest.fn(),
}));

const baseContainer: ContainerInfo = {
  name: "web",
  image: "nginx:1.25",
  ready: false,
  restart_count: 0,
  state: "Terminated",
  state_reason: null,
  last_state: null,
  last_state_reason: null,
  last_exit_code: null,
  last_finished_at: null,
  env_vars: [],
  ports: [],
};

describe("isBenignTermination", () => {
  it.each([
    ["Completed", null, true],
    ["Completed", 0, true],
    [null, 0, true],
    ["Error", 1, false],
    ["OOMKilled", 137, false],
    ["Error", null, false],
    [null, null, false],
  ])("reason=%s exitCode=%s -> %s", (reason, exitCode, expected) => {
    expect(isBenignTermination(reason, exitCode)).toBe(expected);
  });
});

describe("ContainerStatusSection termination colours", () => {
  it("renders a Completed container without the error colour", () => {
    render(
      <ContainerStatusSection
        containers={[{ ...baseContainer, state_reason: "Completed" }]}
        namespace="default"
      />
    );

    const badge = screen.getByText("Terminated: Completed");
    expect(badge.className).not.toContain("text-destructive");
    expect(badge.className).toContain("text-muted-foreground");
  });

  it("keeps the error colour for a failed container", () => {
    render(
      <ContainerStatusSection
        containers={[{ ...baseContainer, state_reason: "Error" }]}
        namespace="default"
      />
    );

    expect(screen.getByText("Terminated: Error").className).toContain("text-destructive");
  });

  it("renders a Completed last termination in neutral colour and a failed one in red", () => {
    render(
      <ContainerStatusSection
        containers={[
          {
            ...baseContainer,
            name: "job",
            state: "Running",
            restart_count: 1,
            last_state: "Terminated",
            last_state_reason: "Completed",
            last_exit_code: 0,
          },
          {
            ...baseContainer,
            name: "crash",
            state: "Running",
            restart_count: 3,
            last_state: "Terminated",
            last_state_reason: "OOMKilled",
            last_exit_code: 137,
          },
        ]}
        namespace="default"
      />
    );

    expect(screen.getByText("Completed").className).toContain("text-muted-foreground");
    expect(screen.getByText("OOMKilled").className).toContain("text-red-400");
  });
});
