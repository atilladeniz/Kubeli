#!/usr/bin/env node
/**
 * Picks which AppImage the updater and the landing page should point at.
 *
 * Releases ship two Linux AppImages (see .github/workflows/publish.yml):
 * the default one built on Ubuntu 22.04, and a "-modern" one built on 24.04
 * for distros whose Mesa is too new for the older bundled WebKitGTK (#429).
 *
 * The updater has a single linux-x86_64 slot, so exactly one of them may go
 * in it. It has to be the 22.04 build: it has the lower glibc floor, and the
 * updater pushes it to every existing install regardless of distro. Picking
 * by plain glob would take "-modern" instead, because it sorts first.
 */

const MODERN_SUFFIX = "-modern.AppImage";

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

module.exports = {
  MODERN_SUFFIX,
  landingAliasFor,
  selectUpdaterAppImage,
  selectUpdaterSignature,
};
