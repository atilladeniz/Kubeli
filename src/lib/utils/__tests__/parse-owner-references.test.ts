import { parseOwnerReferences } from "../parse-owner-references";

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-deploy-abc123
  namespace: default
  ownerReferences:
  - apiVersion: apps/v1
    blockOwnerDeletion: true
    controller: true
    kind: Deployment
    name: my-deploy
    uid: d1234-5678-abcd
spec:
  replicas: 3`;

const POD_YAML = `apiVersion: v1
kind: Pod
metadata:
  name: my-pod-xyz
  namespace: default
  ownerReferences:
  - apiVersion: apps/v1
    blockOwnerDeletion: true
    controller: true
    kind: ReplicaSet
    name: my-deploy-abc123
    uid: rs-uid-1234
spec:
  containers: []`;

const MULTI_OWNER_YAML = `apiVersion: v1
kind: Pod
metadata:
  name: multi-owner
  ownerReferences:
  - apiVersion: apps/v1
    kind: ReplicaSet
    name: owner-one
    uid: uid-1
  - apiVersion: batch/v1
    controller: true
    kind: Job
    name: owner-two
    uid: uid-2
spec: {}`;

const NO_OWNER_YAML = `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: default
data:
  key: value`;

describe("parseOwnerReferences", () => {
  it("parses a single owner reference with controller flag", () => {
    const result = parseOwnerReferences(DEPLOYMENT_YAML);
    expect(result).toEqual([
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "my-deploy",
        uid: "d1234-5678-abcd",
        controller: true,
      },
    ]);
  });

  it("parses owner reference from a Pod", () => {
    const result = parseOwnerReferences(POD_YAML);
    expect(result).toEqual([
      {
        apiVersion: "apps/v1",
        kind: "ReplicaSet",
        name: "my-deploy-abc123",
        uid: "rs-uid-1234",
        controller: true,
      },
    ]);
  });

  it("parses multiple owner references", () => {
    const result = parseOwnerReferences(MULTI_OWNER_YAML);
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({
      apiVersion: "apps/v1",
      kind: "ReplicaSet",
      name: "owner-one",
      uid: "uid-1",
    });
    expect(result![1]).toEqual({
      apiVersion: "batch/v1",
      kind: "Job",
      name: "owner-two",
      uid: "uid-2",
      controller: true,
    });
  });

  it("returns undefined when no ownerReferences exist", () => {
    expect(parseOwnerReferences(NO_OWNER_YAML)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseOwnerReferences("")).toBeUndefined();
  });

  it("returns undefined for malformed YAML", () => {
    expect(parseOwnerReferences("not: valid: yaml: {{")).toBeUndefined();
  });
});
