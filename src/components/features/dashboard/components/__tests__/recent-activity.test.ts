import {
  formatRelativeAge,
  recentRestarts,
  recentWarnings,
  RECENT_WINDOW_HOURS,
} from "../recent-activity";
import type { ContainerInfo, EventInfo, PodInfo } from "@/lib/types";

const NOW = Date.parse("2026-09-12T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

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
  ...overrides,
});

const pod = (overrides: Partial<PodInfo> = {}): PodInfo => ({
  name: "demo-web",
  namespace: "kubeli-demo",
  uid: "pod-uid",
  phase: "Running",
  node_name: "minikube",
  pod_ip: null,
  host_ip: null,
  init_containers: [],
  containers: [container()],
  created_at: null,
  deletion_timestamp: null,
  labels: {},
  restart_count: 0,
  ready_containers: "1/1",
  service_account: null,
  node_selector: {},
  tolerations: [],
  ...overrides,
});

const event = (overrides: Partial<EventInfo> = {}): EventInfo => ({
  name: "evt",
  namespace: "kubeli-demo",
  uid: "evt-uid",
  event_type: "Warning",
  reason: "BackOff",
  message: "Back-off restarting failed container",
  involved_object: {
    kind: "Pod",
    name: "demo-web",
    namespace: "kubeli-demo",
    uid: null,
  },
  count: 1,
  first_timestamp: hoursAgo(1),
  last_timestamp: hoursAgo(1),
  source_component: "kubelet",
  source_host: null,
  created_at: null,
  ...overrides,
});

describe("recentRestarts", () => {
  it("keeps only restarted pods, newest restart first", () => {
    const entries = recentRestarts(
      [
        pod({ name: "calm", restart_count: 0 }),
        pod({
          name: "old-restart",
          restart_count: 2,
          containers: [container({ last_finished_at: hoursAgo(4) })],
        }),
        pod({
          name: "fresh-restart",
          restart_count: 5,
          containers: [container({ last_finished_at: hoursAgo(1) })],
        }),
      ],
      NOW
    );

    expect(entries.map((e) => e.name)).toEqual(["fresh-restart", "old-restart"]);
    expect(entries[0].restarts).toBe(5);
  });

  it("drops restarts older than the window", () => {
    const entries = recentRestarts(
      [
        pod({
          name: "ancient",
          restart_count: 3,
          containers: [container({ last_finished_at: hoursAgo(RECENT_WINDOW_HOURS + 1) })],
        }),
      ],
      NOW
    );

    expect(entries).toHaveLength(0);
  });

  it("dates a pod by its newest container and carries the reason", () => {
    const entries = recentRestarts(
      [
        pod({
          restart_count: 4,
          init_containers: [
            container({ name: "init", last_finished_at: hoursAgo(5), last_state_reason: "Error" }),
          ],
          containers: [
            container({ name: "a", last_finished_at: hoursAgo(3), last_state_reason: "Error" }),
            container({ name: "b", last_finished_at: hoursAgo(1), last_state_reason: "OOMKilled" }),
          ],
        }),
      ],
      NOW
    );

    expect(entries[0].reason).toBe("OOMKilled");
    expect(entries[0].lastRestartAt).toBe(Date.parse(hoursAgo(1)));
  });

  it("keeps a restarted pod without a termination time, sorted last", () => {
    const entries = recentRestarts(
      [
        pod({ name: "undated", restart_count: 9 }),
        pod({
          name: "dated",
          restart_count: 1,
          containers: [container({ last_finished_at: hoursAgo(2) })],
        }),
      ],
      NOW
    );

    expect(entries.map((e) => e.name)).toEqual(["dated", "undated"]);
    expect(entries[1].lastRestartAt).toBeNull();
  });
});

describe("recentWarnings", () => {
  it("ignores Normal events and events outside the window", () => {
    const entries = recentWarnings(
      [
        event({ event_type: "Normal", reason: "Pulled" }),
        event({ last_timestamp: hoursAgo(RECENT_WINDOW_HOURS + 2) }),
        event({ reason: "Unhealthy" }),
      ],
      NOW
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].reason).toBe("Unhealthy");
  });

  it("folds several events of one object into a row with the summed count", () => {
    const entries = recentWarnings(
      [
        event({ reason: "BackOff", count: 4, last_timestamp: hoursAgo(2) }),
        event({ reason: "Unhealthy", count: 3, last_timestamp: hoursAgo(1) }),
      ],
      NOW
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].count).toBe(7);
    // The newest event supplies the summary shown in the row
    expect(entries[0].reason).toBe("Unhealthy");
  });

  it("keeps objects of the same name but different kind apart", () => {
    const entries = recentWarnings(
      [
        event(),
        event({ involved_object: { kind: "Node", name: "demo-web", namespace: null, uid: null } }),
      ],
      NOW
    );

    expect(entries).toHaveLength(2);
  });

  it("restricts the cluster scope to cluster-level kinds", () => {
    const events = [
      event(),
      event({
        reason: "NodeNotReady",
        involved_object: { kind: "Node", name: "minikube", namespace: null, uid: null },
      }),
      event({
        reason: "VolumeFailedDelete",
        involved_object: { kind: "PersistentVolume", name: "pv-1", namespace: null, uid: null },
      }),
    ];

    expect(recentWarnings(events, NOW, { scope: "cluster" }).map((e) => e.kind)).toEqual([
      "Node",
      "PersistentVolume",
    ]);
    expect(recentWarnings(events, NOW)).toHaveLength(3);
  });

  it("sorts newest first", () => {
    const entries = recentWarnings(
      [
        event({
          last_timestamp: hoursAgo(3),
          involved_object: { kind: "Pod", name: "older", namespace: "ns", uid: null },
        }),
        event({
          last_timestamp: hoursAgo(1),
          involved_object: { kind: "Pod", name: "newer", namespace: "ns", uid: null },
        }),
      ],
      NOW
    );

    expect(entries.map((e) => e.name)).toEqual(["newer", "older"]);
  });
});

describe("formatRelativeAge", () => {
  it("steps through seconds, minutes, hours and days", () => {
    expect(formatRelativeAge(NOW - 30_000, NOW)).toBe("30s");
    expect(formatRelativeAge(NOW - 5 * 60_000, NOW)).toBe("5m");
    expect(formatRelativeAge(NOW - 3 * 3600_000, NOW)).toBe("3h");
    expect(formatRelativeAge(NOW - 50 * 3600_000, NOW)).toBe("2d");
    expect(formatRelativeAge(null, NOW)).toBe("-");
  });
});
