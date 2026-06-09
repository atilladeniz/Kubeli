#!/usr/bin/env node
// Verify that the Rust `tauri` crate and the npm `@tauri-apps/api` package
// share the same major.minor version. `tauri-apps/tauri-action` enforces this
// during the release build; we mirror the check earlier so it fails on PRs
// instead of after a tag has been pushed.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function majorMinor(version) {
  const [major, minor] = version.split('.');
  return `${major}.${minor}`;
}

function readNpmApiVersion() {
  const lock = JSON.parse(
    readFileSync(resolve(repoRoot, 'package-lock.json'), 'utf8'),
  );
  const entry = lock.packages?.['node_modules/@tauri-apps/api'];
  if (!entry?.version) {
    throw new Error('@tauri-apps/api not found in package-lock.json');
  }
  return entry.version;
}

function readRustTauriVersion() {
  const lock = readFileSync(resolve(repoRoot, 'src-tauri/Cargo.lock'), 'utf8');
  // Cargo.lock entries look like:
  //   [[package]]
  //   name = "tauri"
  //   version = "2.11.0"
  const match = lock.match(/\[\[package\]\]\s*\nname = "tauri"\s*\nversion = "([^"]+)"/);
  if (!match) {
    throw new Error('tauri crate not found in src-tauri/Cargo.lock');
  }
  return match[1];
}

const apiVersion = readNpmApiVersion();
const crateVersion = readRustTauriVersion();

const apiMm = majorMinor(apiVersion);
const crateMm = majorMinor(crateVersion);

if (apiMm !== crateMm) {
  console.error('Tauri version mismatch:');
  console.error(`  Rust crate     tauri            ${crateVersion}  (${crateMm})`);
  console.error(`  npm package    @tauri-apps/api  ${apiVersion}  (${apiMm})`);
  console.error('');
  console.error('tauri-action requires both to share major.minor.');
  console.error('Bump @tauri-apps/api (and usually @tauri-apps/cli) so they match the Rust crate, e.g.:');
  console.error(`  npm install @tauri-apps/api@^${crateMm}.0 @tauri-apps/cli@^${crateMm}.0`);
  process.exit(1);
}

console.log(`OK: tauri ${crateVersion} matches @tauri-apps/api ${apiVersion} (${apiMm})`);
