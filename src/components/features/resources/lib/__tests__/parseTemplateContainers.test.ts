import { parseTemplateContainers } from "../utils";

const deploymentYaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-web
spec:
  replicas: 3
  template:
    spec:
      initContainers:
        - name: wait-for-db
          image: busybox:1.36
      containers:
        - name: web
          image: nginx:1.25
          ports:
            - containerPort: 80
        - name: sidecar
          image: envoyproxy/envoy:v1.28
`;

describe("parseTemplateContainers", () => {
  it("reads containers from the pod template", () => {
    expect(parseTemplateContainers(deploymentYaml)).toEqual([
      { name: "wait-for-db", image: "busybox:1.36", init: true },
      { name: "web", image: "nginx:1.25", init: false },
      { name: "sidecar", image: "envoyproxy/envoy:v1.28", init: false },
    ]);
  });

  // Init containers run before the others, so they are listed first
  it("puts init containers ahead of regular ones", () => {
    const result = parseTemplateContainers(deploymentYaml);
    expect(result[0].init).toBe(true);
    expect(result.slice(1).every((c) => !c.init)).toBe(true);
  });

  it("handles a template without init containers", () => {
    const yaml = `
spec:
  template:
    spec:
      containers:
        - name: only
          image: alpine:3.19
`;
    expect(parseTemplateContainers(yaml)).toEqual([
      { name: "only", image: "alpine:3.19", init: false },
    ]);
  });

  it("returns empty for undefined or empty input", () => {
    expect(parseTemplateContainers(undefined)).toEqual([]);
    expect(parseTemplateContainers("")).toEqual([]);
  });

  it("returns empty when there is no pod template", () => {
    // A Service has no spec.template
    const yaml = `
kind: Service
spec:
  ports:
    - port: 80
`;
    expect(parseTemplateContainers(yaml)).toEqual([]);
  });

  // CronJobs nest their template under spec.jobTemplate, so they must not
  // accidentally resolve through this path
  it("does not reach into a CronJob's nested template", () => {
    const yaml = `
kind: CronJob
spec:
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: busybox:1.36
`;
    expect(parseTemplateContainers(yaml)).toEqual([]);
  });

  it("survives malformed YAML", () => {
    expect(parseTemplateContainers("spec:\n  template:\n   - broken: [")).toEqual([]);
  });

  it("skips entries without a name", () => {
    const yaml = `
spec:
  template:
    spec:
      containers:
        - image: nginx:1.25
        - name: valid
          image: alpine:3.19
`;
    expect(parseTemplateContainers(yaml)).toEqual([
      { name: "valid", image: "alpine:3.19", init: false },
    ]);
  });

  it("tolerates a container without an image", () => {
    const yaml = `
spec:
  template:
    spec:
      containers:
        - name: no-image
`;
    expect(parseTemplateContainers(yaml)).toEqual([
      { name: "no-image", image: "", init: false },
    ]);
  });

  it("ignores a containers field that is not a list", () => {
    const yaml = `
spec:
  template:
    spec:
      containers: not-a-list
`;
    expect(parseTemplateContainers(yaml)).toEqual([]);
  });
});
