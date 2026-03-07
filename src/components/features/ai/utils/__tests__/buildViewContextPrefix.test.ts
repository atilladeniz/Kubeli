import { buildViewContextPrefix } from "../buildViewContextPrefix";
import type { ViewContext } from "../../hooks/useViewContext";

function createContext(overrides: Partial<ViewContext> = {}): ViewContext {
  return {
    activeView: "cluster-overview",
    activeViewTitle: "Cluster Overview",
    selectedNamespaces: [],
    ...overrides,
  };
}

describe("buildViewContextPrefix", () => {
  it("returns an empty string for a generic cluster overview", () => {
    expect(buildViewContextPrefix(createContext())).toBe("");
  });

  it("includes view, namespaces, log context, and selected resource details", () => {
    const prefix = buildViewContextPrefix(
      createContext({
        activeView: "pod-logs",
        activeViewTitle: "Pod Logs",
        selectedNamespaces: ["default", "kubeli-demo"],
        logContext: {
          namespace: "kubeli-demo",
          podName: "demo-api-123",
          container: "app",
          isStreaming: true,
          logLineCount: 42,
        },
        selectedResource: {
          type: "Deployment",
          name: "demo-api",
          namespace: "kubeli-demo",
        },
      })
    );

    expect(prefix).toContain("[View: Pod Logs]");
    expect(prefix).toContain("[Namespaces: default, kubeli-demo]");
    expect(prefix).toContain(
      '[Viewing logs for pod "demo-api-123" in namespace "kubeli-demo", container "app", streaming, 42 lines]'
    );
    expect(prefix).toContain(
      '[Selected Deployment: "demo-api" in namespace "kubeli-demo"]'
    );
    expect(prefix.endsWith("\n")).toBe(true);
  });

  it("omits namespaces when more than five are selected", () => {
    const prefix = buildViewContextPrefix(
      createContext({
        activeView: "pods",
        activeViewTitle: "Pods",
        selectedNamespaces: ["a", "b", "c", "d", "e", "f"],
      })
    );

    expect(prefix).toContain("[View: Pods]");
    expect(prefix).not.toContain("[Namespaces:");
  });

  it("adds the security warning for sensitive views", () => {
    const prefix = buildViewContextPrefix(
      createContext({
        activeView: "secrets",
        activeViewTitle: "Secrets",
      })
    );

    expect(prefix).toContain("[View: Secrets]");
    expect(prefix).toContain("[SECURITY: NEVER display decoded Secret values");
  });

  it("handles log context without a container and selected resources without a namespace", () => {
    const prefix = buildViewContextPrefix(
      createContext({
        activeView: "pod-logs",
        activeViewTitle: "Pod Logs",
        logContext: {
          namespace: "default",
          podName: "demo-web-123",
          container: null,
          isStreaming: false,
          logLineCount: 5,
        },
        selectedResource: {
          type: "Node",
          name: "minikube",
        },
      })
    );

    expect(prefix).toContain(
      '[Viewing logs for pod "demo-web-123" in namespace "default", 5 lines]'
    );
    expect(prefix).toContain('[Selected Node: "minikube"]');
    expect(prefix).not.toContain("container");
    expect(prefix).not.toContain("streaming");
  });
});
