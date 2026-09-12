import { parseConfigMapFromYaml } from "../utils";

describe("parseConfigMapFromYaml", () => {
  it("keeps block scalar values as multi-line text", () => {
    const yaml = [
      "apiVersion: v1",
      "kind: ConfigMap",
      "metadata:",
      "  name: app-config",
      "data:",
      "  LOG_LEVEL: debug",
      "  app.properties: |",
      "    server.port=8080",
      "    feature.flag=true",
      "",
    ].join("\n");

    expect(parseConfigMapFromYaml(yaml)).toEqual({
      data: {
        LOG_LEVEL: "debug",
        "app.properties": "server.port=8080\nfeature.flag=true\n",
      },
      binaryData: {},
    });
  });

  it("returns binaryData separately and stringifies typed scalars", () => {
    const yaml = [
      "apiVersion: v1",
      "kind: ConfigMap",
      "data:",
      "  retries: 3",
      "  enabled: true",
      "  empty:",
      "binaryData:",
      "  blob.bin: AAEC",
      "",
    ].join("\n");

    expect(parseConfigMapFromYaml(yaml)).toEqual({
      data: { retries: "3", enabled: "true", empty: "" },
      binaryData: { "blob.bin": "AAEC" },
    });
  });

  it("returns empty maps for a ConfigMap without data", () => {
    expect(
      parseConfigMapFromYaml("apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: x\n")
    ).toEqual({ data: {}, binaryData: {} });
  });

  it("returns null for unparsable input", () => {
    expect(parseConfigMapFromYaml("data: [unclosed")).toBeNull();
    expect(parseConfigMapFromYaml("")).toBeNull();
  });
});
