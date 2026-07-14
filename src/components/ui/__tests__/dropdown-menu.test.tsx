import { render, fireEvent } from "@testing-library/react";
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

describe("DropdownMenuSubContent", () => {
  const originalOffsetParent = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetParent"
  );

  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock;
    // jsdom has no layout: offsetParent is always null, which would make the
    // proximity highlight bail. The nearest positioned ancestor of a submenu
    // item is the (relative) sub-content, i.e. its parent element.
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() {
        return (this as HTMLElement).parentElement;
      },
    });
  });

  afterAll(() => {
    if (originalOffsetParent) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetParent",
        originalOffsetParent
      );
    }
  });

  it("shows the proximity highlight for hovered submenu items", () => {
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

    const subContent = baseElement.querySelector(
      '[data-slot="dropdown-menu-sub-content"]'
    ) as HTMLElement;
    expect(subContent).toBeInTheDocument();

    // Items dropped their own :hover background, so the gliding highlight is
    // the only hover cue — it must exist inside the submenu too.
    const item = subContent.querySelector(
      '[data-slot="dropdown-menu-item"]'
    ) as HTMLElement;
    fireEvent.pointerMove(item);

    const highlight = Array.from(subContent.querySelectorAll("div")).find((d) =>
      d.className.includes("bg-[var(--surface-hover)]")
    );
    expect(highlight).toBeDefined();
  });
});
