#!/usr/bin/env node
/**
 * Picks which release artifacts the updater and the landing page point at.
 *
 * Both selections here exist because a release directory holds several
 * artifacts that match the same glob, and `ls ... | head -1` picks the wrong
 * one in each case:
 *
 * - Linux ships two AppImages (see .github/workflows/publish.yml): the
 *   default built on Ubuntu 22.04, and a "-modern" one built on 24.04 for
 *   distros whose Mesa is too new for the older bundled WebKitGTK (#429).
 *   The updater has a single linux-x86_64 slot, so exactly one may go in it.
 *   It has to be the 22.04 build: it has the lower glibc floor, and the
 *   updater pushes it to every install regardless of distro. A plain glob
 *   takes "-modern" instead, because it sorts first.
 *
 * - macOS ships one .app.tar.gz per architecture, and the updater has a
 *   separate slot for each. A plain glob takes aarch64 for both, because it
 *   sorts before x64, and Intel machines then update to an arm64 binary
 *   whose signature validates (#433).
 */

const MODERN_SUFFIX = "-modern.AppImage";

/** The macOS updater slots, and the architecture marker each one requires. */
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
 * The macOS bundle and signature for one updater slot, or null if either is
 * missing. Never falls back to the other architecture: serving an arm64
 * binary to Intel is worse than serving no update, and the signature would
 * still validate because it matches the file being served.
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

// Matches on the "_<arch>." segment rather than a bare substring, so that
// "x64" cannot also match the "aarch64" bundle.
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
