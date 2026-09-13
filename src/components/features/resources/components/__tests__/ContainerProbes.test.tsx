import { render, screen } from "@testing-library/react";
import {
  ContainerStatusSection,
  probeFailureEvents,
  probeTargetText,
} from "../ContainerStatusSection";
import type { ContainerInfo, ContainerProbe } from "@/lib/types";
import type { K8sEvent } from "../../types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

jest.mock("@/components/providers/I18nProvider", () => ({
  useLocale: () => "en",
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/tauri/commands", () => ({
  revealEnvVar: jest.fn(),
}));

const probe = (overrides: Partial<ContainerProbe> = {}): ContainerProbe => ({
  kind: "liveness",
  handler: "http",
  target: "/healthz",
  port: 8080,
  port_name: null,
  initial_delay_seconds: 0,
  period_seconds: 10,
  timeout_seconds: 1,
  success_threshold: 1,
  failure_threshold: 3,
  ...overrides,
});

const container = (overrides: Partial<ContainerInfo> = {}): ContainerInfo => ({
  name: "app",
  image: "demo:1",
  ready: true,
  restart_count: 0,
  state: "Running",
  state_reason: null,
  last_state: null,
  last_state_reason: null,
  last_exit_code: null,
  last_finished_at: null,
  env_vars: [],
  ports: [],
  probes: [],
  ...overrides,
});

const unhealthy = (overrides: Partial<K8sEvent> = {}): K8sEvent => ({
  type: "Warning",
  reason: "Unhealthy",
  message: "Liveness probe failed: HTTP probe failed with statuscode: 500",
  count: 3,
  fieldPath: "spec.containers{app}",
  ...overrides,
});

describe("probeTargetText", () => {
  it("formats every handler with the resolved port", () => {
    expect(probeTargetText(probe())).toBe("HTTP /healthz:8080");
    expect(probeTargetText(probe({ handler: "https", port_name: "web" }))).toBe(
      "HTTPS /healthz:8080 (web)"
    );
    expect(probeTargetText(probe({ handler: "tcp", target: null }))).toBe("TCP:8080");
    expect(
      probeTargetText(probe({ handler: "grpc", target: "health", port: 9090 }))
    ).toBe("gRPC:9090 health");
    expect(
      probeTargetText(probe({ handler: "exec", target: "cat /tmp/ready", port: null }))
    ).toBe("exec cat /tmp/ready");
  });

  it("falls back to the port name when the named port did not resolve", () => {
    expect(probeTargetText(probe({ port: null, port_name: "http" }))).toBe(
      "HTTP /healthz:http"
    );
  });
});

describe("probeFailureEvents", () => {
  it("matches the probe kind and the container field path", () => {
    const events = [
      unhealthy(),
      unhealthy({ message: "Readiness probe failed: connection refused" }),
      unhealthy({ fieldPath: "spec.containers{sidecar}" }),
      { type: "Normal", reason: "Pulled", message: "Liveness probe failed", count: 1 },
    ];

    const matched = probeFailureEvents(events, "app", "liveness");
    expect(matched).toHaveLength(1);
    expect(matched[0].message).toContain("statuscode: 500");
  });

  it("keeps events without a field path and returns nothing without events", () => {
    expect(probeFailureEvents([unhealthy({ fieldPath: undefined })], "app", "liveness")).toHaveLength(1);
    expect(probeFailureEvents(undefined, "app", "liveness")).toHaveLength(0);
  });
});

describe("ContainerStatusSection probes", () => {
  it("renders one row per probe with timing and the failure count", () => {
    render(
      <ContainerStatusSection
        containers={[
          container({
            probes: [
              probe({ kind: "startup", handler: "exec", target: "cat /tmp/ready", port: null }),
              probe({ kind: "liveness", initial_delay_seconds: 15, failure_threshold: 5 }),
            ],
          }),
        ]}
        namespace="kubeli-demo"
        events={[unhealthy()]}
      />
    );

    expect(screen.getByTestId("probe-startup")).toBeInTheDocument();
    expect(screen.getByTestId("probe-liveness")).toBeInTheDocument();
    expect(screen.getByText("exec cat /tmp/ready")).toBeInTheDocument();
    expect(screen.getByText("HTTP /healthz:8080")).toBeInTheDocument();

    // Only the liveness probe has matching Unhealthy events
    expect(screen.getByText('podDetail.probeFailures:{"count":3}')).toBeInTheDocument();
    expect(
      screen.getByText(
        'podDetail.probeTiming:{"delay":15,"period":10,"timeout":1,"failure":5,"success":1}'
      )
    ).toBeInTheDocument();
  });

  it("renders no probe block for a container without probes", () => {
    render(<ContainerStatusSection containers={[container()]} namespace="kubeli-demo" />);

    expect(screen.queryByText("podDetail.probes")).not.toBeInTheDocument();
  });
});
