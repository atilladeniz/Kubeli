import { describe, it, expect } from "vitest";
import { getForwardForPort } from "../PortSelectPopover";
import type { PortForwardInfo, ServicePortInfo } from "@/lib/types";

function makeForward(overrides: Partial<PortForwardInfo> = {}): PortForwardInfo {
  return {
    forward_id: "test-id",
    namespace: "default",
    name: "my-svc",
    target_type: "service",
    target_port: 8080,
    local_port: 31000,
    status: "connected",
    ...overrides,
  };
}

function makePort(overrides: Partial<ServicePortInfo> = {}): ServicePortInfo {
  return {
    name: null,
    port: 80,
    target_port: "8080",
    protocol: "TCP",
    node_port: null,
    ...overrides,
  };
}

describe("getForwardForPort", () => {
  it("matches when forward target_port equals service port", () => {
    const forwards = [makeForward({ target_port: 80 })];
    const port = makePort({ port: 80, target_port: "8080" });
    expect(getForwardForPort(forwards, port)).toBe(forwards[0]);
  });

  it("matches when forward target_port equals numeric target_port", () => {
    const forwards = [makeForward({ target_port: 8080 })];
    const port = makePort({ port: 80, target_port: "8080" });
    expect(getForwardForPort(forwards, port)).toBe(forwards[0]);
  });

  it("matches via requested_port when target_port is a named port", () => {
    // Service port 80 -> named target "http" resolved to container 8080
    const forwards = [makeForward({ target_port: 8080, requested_port: 80 })];
    const port = makePort({ port: 80, target_port: "http" });
    expect(getForwardForPort(forwards, port)).toBe(forwards[0]);
  });

  it("returns undefined when no forward matches", () => {
    const forwards = [makeForward({ target_port: 9090 })];
    const port = makePort({ port: 80, target_port: "8080" });
    expect(getForwardForPort(forwards, port)).toBeUndefined();
  });

  it("does not match named target_port that is not a number", () => {
    // forward on port 8080, service target is "http" (not parseable to 8080)
    const forwards = [makeForward({ target_port: 3000 })];
    const port = makePort({ port: 80, target_port: "http" });
    expect(getForwardForPort(forwards, port)).toBeUndefined();
  });
});
