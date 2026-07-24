import { render } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from "../dropdown-menu";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("DropdownMenu hover", () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock;
  });

  it("items use an instant focus background instead of a gliding highlight", () => {
    const { baseElement } = render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub action</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const item = baseElement.querySelector(
      '[data-slot="dropdown-menu-item"]'
    ) as HTMLElement;
    expect(item.className).toContain("focus:bg-[var(--surface-hover)]");

    const subTrigger = baseElement.querySelector(
      '[data-slot="dropdown-menu-sub-trigger"]'
    ) as HTMLElement;
    expect(subTrigger.className).toContain("focus:bg-[var(--surface-hover)]");

    // The gliding proximity highlight is gone — no animated background layer.
    const highlight = Array.from(baseElement.querySelectorAll("div")).find(
      (d) =>
        d.getAttribute("aria-hidden") === "true" &&
        d.className.includes("bg-[var(--surface-hover)]")
    );
    expect(highlight).toBeUndefined();
  });
});
