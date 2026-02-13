import React from "react";
import { render } from "@testing-library/react";
import { Sparkline } from "../Sparkline";

describe("Sparkline", () => {
  it("renders nothing with empty array", () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing with single value", () => {
    const { container } = render(<Sparkline values={[5]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders SVG with multiple values", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.querySelector("polyline")).not.toBeNull();
    expect(svg!.querySelector("polygon")).not.toBeNull();
  });

  it("respects width and height props", () => {
    const { container } = render(
      <Sparkline values={[1, 2, 3]} width={100} height={32} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("width")).toBe("100");
    expect(svg!.getAttribute("height")).toBe("32");
  });

  it("applies custom color to polyline stroke", () => {
    const { container } = render(
      <Sparkline values={[1, 2, 3]} color="#ff0000" />,
    );
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    expect(polyline!.getAttribute("stroke")).toBe("#ff0000");
  });

  it("uses default dimensions when not specified", () => {
    const { container } = render(<Sparkline values={[10, 20]} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("width")).toBe("50");
    expect(svg!.getAttribute("height")).toBe("16");
  });
});
