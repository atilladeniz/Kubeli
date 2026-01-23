import { render, screen } from "@testing-library/react";
import { ClusterIcon, ClusterIconByType } from "../cluster-icon";

describe("ClusterIcon", () => {
  it("renders the icon for a detected cluster type", () => {
    render(
      <ClusterIcon
        cluster={{
          name: "gke-demo",
          context: "gke_project_us-central1_demo",
          server: "https://container.googleapis.com/v1/projects/demo",
        }}
      />
    );

    const icon = screen.getByAltText("gke");
    expect(icon).toHaveAttribute("src", "/googlekubernetesengine.svg");
  });

  it("renders the icon by explicit type", () => {
    render(<ClusterIconByType type="eks" size={32} />);

    const icon = screen.getByAltText("eks");
    expect(icon).toHaveAttribute("src", "/amazoneks.svg");
  });
});
