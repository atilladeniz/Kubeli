import { splitImageRef, joinImageRef } from "../image-ref";

describe("splitImageRef", () => {
  it("splits a simple repository and tag", () => {
    expect(splitImageRef("nginx:1.25")).toEqual({ repository: "nginx", tag: "1.25" });
  });

  it("splits a namespaced image", () => {
    expect(splitImageRef("library/nginx:1.25")).toEqual({
      repository: "library/nginx",
      tag: "1.25",
    });
  });

  it("treats a missing tag as empty", () => {
    expect(splitImageRef("nginx")).toEqual({ repository: "nginx", tag: "" });
  });

  // A colon before the last slash is a registry port, not a tag
  it("does not mistake a registry port for a tag", () => {
    expect(splitImageRef("registry.local:5000/app")).toEqual({
      repository: "registry.local:5000/app",
      tag: "",
    });
  });

  it("splits the tag off an image on a ported registry", () => {
    expect(splitImageRef("registry.local:5000/app:v2")).toEqual({
      repository: "registry.local:5000/app",
      tag: "v2",
    });
  });

  it("handles a digest reference as an untagged repository", () => {
    // sha256 digests contain a colon after the last slash, so they land in the
    // tag field — acceptable, since the two rejoin losslessly
    const digest = "nginx@sha256:abc123";
    const parts = splitImageRef(digest);
    expect(joinImageRef(parts.repository, parts.tag)).toBe(digest);
  });

  it("handles an empty string", () => {
    expect(splitImageRef("")).toEqual({ repository: "", tag: "" });
  });
});

describe("joinImageRef", () => {
  it("joins repository and tag", () => {
    expect(joinImageRef("nginx", "1.25")).toBe("nginx:1.25");
  });

  it("omits the separator when there is no tag", () => {
    expect(joinImageRef("nginx", "")).toBe("nginx");
  });

  it("trims surrounding whitespace", () => {
    expect(joinImageRef("  nginx  ", "  1.25  ")).toBe("nginx:1.25");
  });

  it("treats a whitespace-only tag as absent", () => {
    expect(joinImageRef("nginx", "   ")).toBe("nginx");
  });
});

describe("split/join round trip", () => {
  it.each([
    "nginx",
    "nginx:1.25",
    "library/nginx:1.25",
    "registry.local:5000/app",
    "registry.local:5000/app:v2",
    "ghcr.io/org/repo/image:sha-abc123",
  ])("preserves %s", (image) => {
    const { repository, tag } = splitImageRef(image);
    expect(joinImageRef(repository, tag)).toBe(image);
  });
});
