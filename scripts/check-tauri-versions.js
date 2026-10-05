#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Verify that every Tauri Rust crate and its npm counterpart share the same
// major.minor version: `tauri` <-> `@tauri-apps/api` and each
// `tauri-plugin-<name>` <-> `@tauri-apps/plugin-<name>`. The Tauri CLI
// enforces this during the release build; we mirror the check earlier so it
// fails on PRs instead of after a tag has been pushed.

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const repoRoot = resolve(__dirname, "..");

function majorMinor(version) {
  const [major, minor] = version.split(".");
  return `${major}.${minor}`;
}

// Cargo.lock entries look like:
//   [[package]]
//   name = "tauri"
//   version = "2.11.0"
function crateVersion(cargoLock, name) {
  const match = cargoLock.match(
    new RegExp(`\\[\\[package\\]\\]\\s*\\nname = "${name}"\\s*\\nversion = "([^"]+)"`),
  );
  return match?.[1];
}

// Pairs each npm package with the crate it must match. Plugins without a Rust
// crate in the lockfile are skipped; the CLI ignores them too.
function findMismatches(npmLock, cargoLock) {
  const pairs = [];
  for (const [path, entry] of Object.entries(npmLock.packages ?? {})) {
    // Nested copies ("node_modules/x/node_modules/...") never match below.
    const npmName = path.replace(/^node_modules\//, "");
    if (npmName === "@tauri-apps/api") pairs.push([npmName, "tauri", entry.version]);
    const plugin = npmName.match(/^@tauri-apps\/plugin-(.+)$/)?.[1];
    if (plugin) pairs.push([npmName, `tauri-plugin-${plugin}`, entry.version]);
  }

  return pairs
    .map(([npmName, crate, npmVersion]) => ({
      npmName,
      npmVersion,
      crate,
      crateVersion: crateVersion(cargoLock, crate),
    }))
    .filter((p) => p.crateVersion && majorMinor(p.crateVersion) !== majorMinor(p.npmVersion));
}

function main() {
  const npmLock = JSON.parse(readFileSync(resolve(repoRoot, "package-lock.json"), "utf8"));
  const cargoLock = readFileSync(resolve(repoRoot, "src-tauri/Cargo.lock"), "utf8");

  if (!crateVersion(cargoLock, "tauri")) {
    throw new Error("tauri crate not found in src-tauri/Cargo.lock");
  }

  const mismatches = findMismatches(npmLock, cargoLock);
  if (mismatches.length > 0) {
    console.error("Tauri version mismatch (major.minor must match):");
    for (const m of mismatches) {
      console.error(`  ${m.crate} ${m.crateVersion}  <->  ${m.npmName} ${m.npmVersion}`);
    }
    console.error("");
    console.error("Bump the npm packages to match the Rust crates, e.g.:");
    const fix = mismatches.map((m) => `${m.npmName}@~${majorMinor(m.crateVersion)}.0`);
    console.error(`  npm install ${fix.join(" ")}`);
    process.exit(1);
  }

  console.log("OK: all Tauri npm packages match their Rust crates");
}

if (require.main === module) main();

module.exports = { findMismatches };
