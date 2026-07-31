/* eslint-disable @typescript-eslint/no-require-imports */
/* global describe, expect, it */
const {
  landingAliasFor,
  selectUpdaterAppImage,
  selectUpdaterSignature,
} = require("../select-linux-artifacts");

const COMPAT = "Kubeli_0.4.0_amd64.AppImage";
const MODERN = "Kubeli_0.4.0_amd64-modern.AppImage";

// A release directory as the publish workflow sees it: both AppImages, both
// signatures, plus the packages that must never be mistaken for one.
const RELEASE = [
  MODERN,
  `${MODERN}.sig`,
  COMPAT,
  `${COMPAT}.sig`,
  "Kubeli_0.4.0_amd64.deb",
  "Kubeli-0.4.0-1.x86_64.rpm",
];

describe("updater artifact selection", () => {
  // The bug this guards: "-modern" sorts before the compatibility build, so
  // any first-match glob hands the updater the glibc 2.39 binary and every
  // Ubuntu 22.04 install fails to start after updating.
  it("never picks the modern build, even though it sorts first", () => {
    const appImagesInGlobOrder = RELEASE.filter(
      (name) => name.endsWith(".AppImage"),
    ).sort();
    expect(appImagesInGlobOrder[0]).toBe(MODERN);

    expect(selectUpdaterAppImage(RELEASE)).toBe(COMPAT);
  });

  it("pairs the signature with the AppImage it belongs to", () => {
    expect(selectUpdaterSignature(RELEASE)).toBe(`${COMPAT}.sig`);
  });

  it("still resolves when the modern build failed to produce artifacts", () => {
    const onlyCompat = [COMPAT, `${COMPAT}.sig`];
    expect(selectUpdaterAppImage(onlyCompat)).toBe(COMPAT);
    expect(selectUpdaterSignature(onlyCompat)).toBe(`${COMPAT}.sig`);
  });

  // Publishing a latest.json whose linux slot points at the modern build is
  // worse than publishing none, so an unusable set must resolve to null.
  it("reports nothing when only the modern build exists", () => {
    expect(selectUpdaterAppImage([MODERN, `${MODERN}.sig`])).toBeNull();
    expect(selectUpdaterSignature([MODERN, `${MODERN}.sig`])).toBeNull();
  });

  it("does not mistake a deb or rpm for an AppImage", () => {
    expect(
      selectUpdaterAppImage(["Kubeli_0.4.0_amd64.deb", "Kubeli-0.4.0-1.x86_64.rpm"]),
    ).toBeNull();
  });

  it("omits the signature when it is missing rather than guessing", () => {
    expect(selectUpdaterSignature([COMPAT])).toBeNull();
  });
});

describe("landing page aliases", () => {
  it("keeps the existing download link on the compatibility build", () => {
    expect(landingAliasFor(COMPAT)).toBe("Kubeli_latest_amd64.AppImage");
  });

  it("gives the modern build an alias of its own", () => {
    expect(landingAliasFor(MODERN)).toBe("Kubeli_latest_amd64-modern.AppImage");
  });

  it("maps the two variants to distinct aliases", () => {
    expect(landingAliasFor(COMPAT)).not.toBe(landingAliasFor(MODERN));
  });
});
