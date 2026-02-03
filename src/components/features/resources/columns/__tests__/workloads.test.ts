import { getEffectivePodStatus } from "@/lib/utils/pod-status";
import type { PodInfo, ContainerInfo } from "@/lib/types";

const createMockContainer = (overrides: Partial<ContainerInfo> = {}): ContainerInfo => ({
  name: "container-1",
  image: "nginx:latest",
  ready: true,
  restart_count: 0,
  state: "Running",
  state_reason: null,
  last_state: null,
  last_state_reason: null,
  last_exit_code: null,
  last_finished_at: null,
  ...overrides,
});

const createMockPod = (overrides: Partial<PodInfo> = {}): PodInfo => ({
  name: "test-pod",
  namespace: "default",
  uid: "test-uid",
  phase: "Running",
  node_name: "node-1",
  pod_ip: "10.0.0.1",
  host_ip: "192.168.1.1",
  init_containers: [],
  containers: [createMockContainer()],
  created_at: "2024-01-01T00:00:00Z",
  deletion_timestamp: null,
  labels: {},
  restart_count: 0,
  ready_containers: "1/1",
  ...overrides,
});

describe("getEffectivePodStatus", () => {
  describe("basic pod phases", () => {
    it("should return Running for healthy running pod", () => {
      const pod = createMockPod({ phase: "Running" });
      expect(getEffectivePodStatus(pod)).toBe("Running");
    });

    it("should return Pending for pending pod", () => {
      const pod = createMockPod({ phase: "Pending" });
      expect(getEffectivePodStatus(pod)).toBe("Pending");
    });

    it("should return Succeeded for succeeded pod", () => {
      const pod = createMockPod({ phase: "Succeeded" });
      expect(getEffectivePodStatus(pod)).toBe("Succeeded");
    });

    it("should return Failed for failed pod", () => {
      const pod = createMockPod({ phase: "Failed" });
      expect(getEffectivePodStatus(pod)).toBe("Failed");
    });
  });

  describe("terminating pods", () => {
    it("should return Terminating when deletion_timestamp is set", () => {
      const pod = createMockPod({
        phase: "Running",
        deletion_timestamp: "2024-01-01T12:00:00Z",
      });
      expect(getEffectivePodStatus(pod)).toBe("Terminating");
    });

    it("should prioritize Terminating over container issues", () => {
      const pod = createMockPod({
        phase: "Running",
        deletion_timestamp: "2024-01-01T12:00:00Z",
        containers: [createMockContainer({ state: "Waiting", state_reason: "CrashLoopBackOff" })],
      });
      expect(getEffectivePodStatus(pod)).toBe("Terminating");
    });
  });

  describe("init container issues", () => {
    it("should return Init:ImagePullBackOff for init container with ImagePullBackOff", () => {
      const pod = createMockPod({
        phase: "Pending",
        init_containers: [createMockContainer({ state: "Waiting", state_reason: "ImagePullBackOff" })],
      });
      expect(getEffectivePodStatus(pod)).toBe("Init:ImagePullBackOff");
    });

    it("should return Init:ErrImagePull for init container with ErrImagePull", () => {
      const pod = createMockPod({
        phase: "Pending",
        init_containers: [createMockContainer({ state: "Waiting", state_reason: "ErrImagePull" })],
      });
      expect(getEffectivePodStatus(pod)).toBe("Init:ErrImagePull");
    });

    it("should ignore init containers without state_reason", () => {
      const pod = createMockPod({
        phase: "Running",
        init_containers: [createMockContainer({ state: "Waiting", state_reason: null })],
      });
      expect(getEffectivePodStatus(pod)).toBe("Running");
    });

    it("should prioritize init container issues over regular container issues", () => {
      const pod = createMockPod({
        phase: "Running",
        init_containers: [createMockContainer({ state: "Waiting", state_reason: "ImagePullBackOff" })],
        containers: [createMockContainer({ state: "Waiting", state_reason: "CrashLoopBackOff" })],
      });
      expect(getEffectivePodStatus(pod)).toBe("Init:ImagePullBackOff");
    });
  });

  describe("container issues", () => {
    it("should return CrashLoopBackOff for container in CrashLoopBackOff", () => {
      const pod = createMockPod({
        phase: "Running",
        containers: [createMockContainer({ state: "Waiting", state_reason: "CrashLoopBackOff" })],
      });
      expect(getEffectivePodStatus(pod)).toBe("CrashLoopBackOff");
    });

    it("should return ImagePullBackOff for container with ImagePullBackOff", () => {
      const pod = createMockPod({
        phase: "Running",
        containers: [createMockContainer({ state: "Waiting", state_reason: "ImagePullBackOff" })],
      });
      expect(getEffectivePodStatus(pod)).toBe("ImagePullBackOff");
    });

    it("should return Error for container with Error reason", () => {
      const pod = createMockPod({
        phase: "Running",
        containers: [createMockContainer({ state: "Waiting", state_reason: "Error" })],
      });
      expect(getEffectivePodStatus(pod)).toBe("Error");
    });

    it("should return first container issue when multiple containers have issues", () => {
      const pod = createMockPod({
        phase: "Running",
        containers: [
          createMockContainer({ name: "c1", state: "Waiting", state_reason: "CrashLoopBackOff" }),
          createMockContainer({ name: "c2", state: "Waiting", state_reason: "ImagePullBackOff" }),
        ],
      });
      expect(getEffectivePodStatus(pod)).toBe("CrashLoopBackOff");
    });

    it("should ignore containers without state_reason", () => {
      const pod = createMockPod({
        phase: "Running",
        containers: [createMockContainer({ state: "Waiting", state_reason: null })],
      });
      expect(getEffectivePodStatus(pod)).toBe("Running");
    });

    it("should ignore running containers", () => {
      const pod = createMockPod({
        phase: "Running",
        containers: [createMockContainer({ state: "Running", state_reason: null })],
      });
      expect(getEffectivePodStatus(pod)).toBe("Running");
    });
  });

  describe("edge cases", () => {
    it("should handle pod with no containers", () => {
      const pod = createMockPod({
        phase: "Running",
        init_containers: [],
        containers: [],
      });
      expect(getEffectivePodStatus(pod)).toBe("Running");
    });

    it("should handle pod with undefined init_containers", () => {
      const pod = createMockPod({ phase: "Running" });
      // @ts-expect-error - testing undefined case
      pod.init_containers = undefined;
      expect(getEffectivePodStatus(pod)).toBe("Running");
    });

    it("should handle pod with undefined containers", () => {
      const pod = createMockPod({ phase: "Running" });
      // @ts-expect-error - testing undefined case
      pod.containers = undefined;
      expect(getEffectivePodStatus(pod)).toBe("Running");
    });
  });
});
