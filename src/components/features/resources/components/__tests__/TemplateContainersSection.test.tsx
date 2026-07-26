import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateContainersSection } from "../TemplateContainersSection";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const yamlWith = (body: string) => `
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
${body}
`;

describe("TemplateContainersSection", () => {
  it("lists each container with its image", () => {
    render(
      <TemplateContainersSection
        yaml={yamlWith(`      containers:
        - name: web
          image: nginx:1.25
        - name: sidecar
          image: envoyproxy/envoy:v1.28`)}
      />
    );

    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("nginx:1.25")).toBeInTheDocument();
    expect(screen.getByText("sidecar")).toBeInTheDocument();
    expect(screen.getByText("envoyproxy/envoy:v1.28")).toBeInTheDocument();
  });

  it("marks init containers and lists them first", () => {
    const { container } = render(
      <TemplateContainersSection
        yaml={yamlWith(`      initContainers:
        - name: migrate
          image: busybox:1.36
      containers:
        - name: web
          image: nginx:1.25`)}
      />
    );

    const names = Array.from(
      container.querySelectorAll("span.font-medium.text-sm"),
      (el) => el.textContent
    );
    expect(names).toEqual(["migrate", "web"]);
    // Only the init container carries the badge
    expect(screen.getAllByText("podDetail.initContainer")).toHaveLength(1);
  });

  it("shows the container count", () => {
    render(
      <TemplateContainersSection
        yaml={yamlWith(`      containers:
        - name: a
          image: alpine:3.19
        - name: b
          image: alpine:3.19`)}
      />
    );

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders nothing without a pod template", () => {
    const { container } = render(
      <TemplateContainersSection yaml={"kind: Service\nspec:\n  ports:\n    - port: 80"} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the YAML has not loaded yet", () => {
    const { container } = render(<TemplateContainersSection yaml={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a dash for a container without an image", () => {
    render(
      <TemplateContainersSection
        yaml={yamlWith(`      containers:
        - name: no-image`)}
      />
    );
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows no Set Image button without a handler", () => {
    render(
      <TemplateContainersSection
        yaml={yamlWith(`      containers:
        - name: web
          image: nginx:1.25`)}
      />
    );
    expect(screen.queryByText("workloads.setImage")).toBeNull();
  });

  it("offers Set Image when a handler is provided", async () => {
    const onSetImage = jest.fn();
    render(
      <TemplateContainersSection
        yaml={yamlWith(`      containers:
        - name: web
          image: nginx:1.25`)}
        onSetImage={onSetImage}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "workloads.setImage" }));
    expect(onSetImage).toHaveBeenCalledTimes(1);
  });
});
