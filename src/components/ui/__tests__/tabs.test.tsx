import { createRef } from "react";
import { render } from "@testing-library/react";
import { Tabs, TabsList, TabsTrigger } from "../tabs";

describe("TabsList", () => {
  it("forwards refs and marks the active trigger with a static highlight", () => {
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

    // The sliding pill is gone — no animated aria-hidden layer.
    expect(
      container.querySelector('[data-slot="tabs-list"] > [aria-hidden]')
    ).toBeNull();

    // The active trigger carries its own (instant, high-contrast) background.
    const active = container.querySelector(
      '[data-slot="tabs-trigger"][data-state="active"]'
    ) as HTMLElement;
    expect(active.className).toContain("data-[state=active]:bg-surface-5");
  });
});
