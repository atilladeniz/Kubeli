import { renderHook } from "@testing-library/react";
import { useNavigationSections, hasFluxCRDs, hasArgoCDCRDs } from "../navigation";
import type { CRDInfo } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const crd = (group: string, kind: string): CRDInfo => ({
  name: `${kind.toLowerCase()}s.${group}`,
  uid: "u",
  group,
  scope: "Namespaced",
  kind,
  singular: kind.toLowerCase(),
  plural: `${kind.toLowerCase()}s`,
  short_names: [],
  versions: [],
  stored_versions: [],
  conditions_ready: true,
  created_at: null,
  labels: {},
});

const flux = crd("kustomize.toolkit.fluxcd.io", "Kustomization");
const argo = crd("argoproj.io", "Application");
const other = crd("cert-manager.io", "Certificate");

const gitopsItems = (crds?: CRDInfo[]) => {
  const { result } = renderHook(() => useNavigationSections(crds));
  const gitops = result.current.find((s) => s.id === "gitops");
  if (!gitops) throw new Error("no gitops section");
  return { ids: gitops.items.map((i) => i.id), sections: result.current.map((s) => s.id) };
};

describe("useNavigationSections GitOps section", () => {
  // Regression: Flux and ArgoCD were always listed, giving empty views and
  // 404s on clusters without those CRDs.
  it("shows only Helm when the cluster has no GitOps CRDs", () => {
    const { ids, sections } = gitopsItems([other]);

    expect(ids).toEqual(["helm-releases"]);
    expect(sections).not.toEqual(expect.arrayContaining(["helm", "flux", "argocd"]));
  });

  it("shows Helm alone while the CRD list has not loaded", () => {
    expect(gitopsItems(undefined).ids).toEqual(["helm-releases"]);
  });

  it("adds Flux and ArgoCD when their CRDs exist", () => {
    expect(gitopsItems([flux]).ids).toEqual(["helm-releases", "flux-kustomizations"]);
    expect(gitopsItems([argo]).ids).toEqual(["helm-releases", "argocd-applications"]);
    expect(gitopsItems([other, flux, argo]).ids).toEqual([
      "helm-releases",
      "flux-kustomizations",
      "argocd-applications",
    ]);
  });
});

describe("CRD detection", () => {
  it("recognises any Flux toolkit group", () => {
    expect(hasFluxCRDs([crd("source.toolkit.fluxcd.io", "GitRepository")])).toBe(true);
    expect(hasFluxCRDs([other])).toBe(false);
  });

  it("requires the ArgoCD Application kind, not just the argoproj group", () => {
    expect(hasArgoCDCRDs([crd("argoproj.io", "Workflow")])).toBe(false);
    expect(hasArgoCDCRDs([argo])).toBe(true);
  });
});
