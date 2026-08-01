#!/usr/bin/env node
/**
 * Picks which release artifacts the updater points at.
 *
 * A release holds several artifacts matching the same glob, and the one that
 * sorts first is the wrong one in both cases: "-modern" before the
 * compatibility AppImage (#429), aarch64 before x64 (#433).
 *
 * The Linux slot must get the 22.04 AppImage — it has the lower glibc floor
 * and the updater pushes it to every install regardless of distro.
 */

const MODERN_SUFFIX = "-modern.AppImage";

const MAC_ARCHITECTURES = {
  "darwin-aarch64": "aarch64",
  "darwin-x86_64": "x64",
};

/** The AppImage safe to hand to every install, or null if it is missing. */
function selectUpdaterAppImage(fileNames) {
  return fileNames.filter(isCompatibilityAppImage).sort()[0] ?? null;
}

/** Its detached updater signature, matched by name so the pair can't drift. */
function selectUpdaterSignature(fileNames) {
  const appImage = selectUpdaterAppImage(fileNames);
  if (!appImage) return null;
  const signature = `${appImage}.sig`;
  return fileNames.includes(signature) ? signature : null;
}

/** Stable download alias per variant, e.g. Kubeli_latest_amd64.AppImage. */
function landingAliasFor(fileName) {
  return fileName.endsWith(MODERN_SUFFIX)
    ? "Kubeli_latest_amd64-modern.AppImage"
    : "Kubeli_latest_amd64.AppImage";
}

function isCompatibilityAppImage(fileName) {
  return (
    fileName.endsWith(".AppImage") && !fileName.endsWith(MODERN_SUFFIX)
  );
}

/**
 * Never falls back to the other architecture: an arm64 binary on Intel is
 * worse than no update, and its signature validates either way.
 */
function selectMacUpdateForSlot(fileNames, slot) {
  const arch = MAC_ARCHITECTURES[slot];
  if (!arch) return null;

  const bundle = fileNames
    .filter((name) => isMacBundleForArch(name, arch))
    .sort()[0];
  if (!bundle) return null;

  const signature = `${bundle}.sig`;
  if (!fileNames.includes(signature)) return null;

  return { bundle, signature };
}

// Anchored on the full segment so "x64" cannot match the aarch64 bundle.
function isMacBundleForArch(fileName, arch) {
  return fileName.endsWith(`_${arch}.app.tar.gz`);
}

module.exports = {
  MAC_ARCHITECTURES,
  MODERN_SUFFIX,
  landingAliasFor,
  selectMacUpdateForSlot,
  selectUpdaterAppImage,
  selectUpdaterSignature,
};
