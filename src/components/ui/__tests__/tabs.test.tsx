import { createRef } from "react";
import { render } from "@testing-library/react";
import { Tabs, TabsList, TabsTrigger } from "../tabs";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("TabsList", () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock;
  });

  it("preserves pill measurement when a caller provides a ref", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <Tabs defaultValue="first">
        <TabsList ref={ref}>
          <TabsTrigger value="first">First</TabsTrigger>
          <TabsTrigger value="second">Second</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(ref.current).toHaveAttribute("data-slot", "tabs-list");
    expect(container.querySelector('[data-slot="tabs-list"] > [aria-hidden]')).toHaveStyle({
      opacity: "1",
    });
  });
});
