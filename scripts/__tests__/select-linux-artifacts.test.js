/* eslint-disable @typescript-eslint/no-require-imports */
/* global describe, expect, it */
const {
  landingAliasFor,
  selectMacUpdateForSlot,
  selectUpdaterAppImage,
  selectUpdaterSignature,
} = require("../select-linux-artifacts");

const COMPAT = "Kubeli_0.4.0_amd64.AppImage";
const MODERN = "Kubeli_0.4.0_amd64-modern.AppImage";
const MAC_ARM = "Kubeli_0.4.0_aarch64.app.tar.gz";
const MAC_INTEL = "Kubeli_0.4.0_x64.app.tar.gz";

// A release directory as the publish workflow sees it: both AppImages, both
// signatures, plus the packages that must never be mistaken for one.
const RELEASE = [
  MODERN,
  `${MODERN}.sig`,
  COMPAT,
  `${COMPAT}.sig`,
  "Kubeli_0.4.0_amd64.deb",
  "Kubeli-0.4.0-1.x86_64.rpm",
  MAC_ARM,
  `${MAC_ARM}.sig`,
  MAC_INTEL,
  `${MAC_INTEL}.sig`,
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

describe("macOS updater slots", () => {
  it("gives each architecture its own bundle, not the one that sorts first", () => {
    const macBundlesInGlobOrder = RELEASE.filter((name) =>
      name.endsWith(".app.tar.gz"),
    ).sort();
    expect(macBundlesInGlobOrder[0]).toBe(MAC_ARM);

    expect(selectMacUpdateForSlot(RELEASE, "darwin-x86_64").bundle).toBe(MAC_INTEL);
    expect(selectMacUpdateForSlot(RELEASE, "darwin-aarch64").bundle).toBe(MAC_ARM);
  });

  it("pairs each bundle with its own signature", () => {
    expect(selectMacUpdateForSlot(RELEASE, "darwin-x86_64").signature).toBe(
      `${MAC_INTEL}.sig`,
    );
    expect(selectMacUpdateForSlot(RELEASE, "darwin-aarch64").signature).toBe(
      `${MAC_ARM}.sig`,
    );
  });

  it("reports nothing rather than substituting the other architecture", () => {
    const armOnly = [MAC_ARM, `${MAC_ARM}.sig`];
    expect(selectMacUpdateForSlot(armOnly, "darwin-x86_64")).toBeNull();

    const intelOnly = [MAC_INTEL, `${MAC_INTEL}.sig`];
    expect(selectMacUpdateForSlot(intelOnly, "darwin-aarch64")).toBeNull();
  });

  it("omits a slot whose signature is missing rather than guessing", () => {
    expect(selectMacUpdateForSlot([MAC_INTEL, MAC_ARM], "darwin-x86_64")).toBeNull();
  });

  it("does not let the arm bundle satisfy the intel slot", () => {
    expect(selectMacUpdateForSlot([MAC_ARM, `${MAC_ARM}.sig`], "darwin-x86_64")).toBeNull();
  });

  it("ignores the .dmg and the AppImages", () => {
    const noMacTarballs = [COMPAT, `${COMPAT}.sig`, "Kubeli_0.4.0_x64.dmg"];
    expect(selectMacUpdateForSlot(noMacTarballs, "darwin-x86_64")).toBeNull();
  });

  it("returns nothing for a slot it does not know", () => {
    expect(selectMacUpdateForSlot(RELEASE, "linux-x86_64")).toBeNull();
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
