/* eslint-disable @typescript-eslint/no-require-imports */
/* global describe, expect, it */
const { findMismatches } = require("../check-tauri-versions");

function cargoLock(crates) {
  return Object.entries(crates)
    .map(([name, version]) => `[[package]]\nname = "${name}"\nversion = "${version}"\n`)
    .join("\n");
}

function npmLock(packages) {
  const entries = Object.entries(packages).map(([name, version]) => [
    `node_modules/${name}`,
    { version },
  ]);
  return { packages: { "": {}, ...Object.fromEntries(entries) } };
}

describe("findMismatches", () => {
  it("accepts matching major.minor with different patch versions", () => {
    const npm = npmLock({ "@tauri-apps/api": "2.12.1", "@tauri-apps/plugin-fs": "2.6.0" });
    const cargo = cargoLock({ tauri: "2.12.0", "tauri-plugin-fs": "2.6.3" });
    expect(findMismatches(npm, cargo)).toEqual([]);
  });

  it("flags a tauri vs @tauri-apps/api mismatch", () => {
    const npm = npmLock({ "@tauri-apps/api": "2.11.0" });
    const cargo = cargoLock({ tauri: "2.12.0" });
    expect(findMismatches(npm, cargo)).toEqual([
      { npmName: "@tauri-apps/api", npmVersion: "2.11.0", crate: "tauri", crateVersion: "2.12.0" },
    ]);
  });

  // Regression: v0.3.90 failed in the release build because only tauri/api was
  // checked while cargo had moved tauri-plugin-dialog and friends a minor ahead.
  it("flags plugin mismatches even when tauri and api match", () => {
    const npm = npmLock({
      "@tauri-apps/api": "2.12.1",
      "@tauri-apps/plugin-dialog": "2.7.0",
      "@tauri-apps/plugin-os": "2.4.0",
    });
    const cargo = cargoLock({
      tauri: "2.12.1",
      "tauri-plugin-dialog": "2.8.1",
      "tauri-plugin-os": "2.4.0",
    });
    expect(findMismatches(npm, cargo).map((m) => m.npmName)).toEqual([
      "@tauri-apps/plugin-dialog",
    ]);
  });

  it("ignores nested copies and plugins without a Rust crate", () => {
    const npm = npmLock({ "@tauri-apps/api": "2.12.0", "@tauri-apps/plugin-shell": "2.0.0" });
    npm.packages["node_modules/foo/node_modules/@tauri-apps/api"] = { version: "1.0.0" };
    const cargo = cargoLock({ tauri: "2.12.0" });
    expect(findMismatches(npm, cargo)).toEqual([]);
  });
});
