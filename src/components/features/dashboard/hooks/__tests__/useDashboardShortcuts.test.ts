import { renderHook, act } from "@testing-library/react";
import { useDashboardShortcuts } from "../useDashboardShortcuts";

jest.mock("sonner", () => ({ toast: { warning: jest.fn() } }));

const press = (key: string, init: KeyboardEventInit = {}) => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));
  });
};

function setup() {
  const fns = {
    closeTab: jest.fn(),
    getTabTitle: jest.fn(() => "Overview"),
    navigateToFavorite: jest.fn(),
    openCreateResource: jest.fn(),
    openShortcutsHelp: jest.fn(),
    openTab: jest.fn(),
    setActiveResource: jest.fn(),
    setActiveTab: jest.fn(),
    toggleAIAssistant: jest.fn(),
    triggerRefresh: jest.fn(),
    triggerSearchFocus: jest.fn(),
  };
  renderHook(() =>
    useDashboardShortcuts({
      enabled: true,
      activeTabId: "tab-1",
      isAICliAvailable: true,
      resourceTabs: [],
      tabLimitToast: "limit",
      ...fns,
    })
  );
  return fns;
}

describe("useDashboardShortcuts", () => {
  it("opens the help with ? and with Cmd or Ctrl + /", () => {
    const fns = setup();

    press("?");
    press("/", { metaKey: true });
    press("/", { ctrlKey: true });

    expect(fns.openShortcutsHelp).toHaveBeenCalledTimes(3);
    expect(fns.triggerSearchFocus).not.toHaveBeenCalled();
  });

  it("keeps plain / for the search", () => {
    const fns = setup();

    press("/");

    expect(fns.triggerSearchFocus).toHaveBeenCalledTimes(1);
    expect(fns.openShortcutsHelp).not.toHaveBeenCalled();
  });

  it("wires the registry entries to their handlers", () => {
    const fns = setup();

    press("g");
    press("p");
    press("g");
    press("i");
    press("3", { metaKey: true });

    expect(fns.setActiveResource).toHaveBeenCalledWith("pods");
    expect(fns.toggleAIAssistant).toHaveBeenCalledTimes(1);
    expect(fns.navigateToFavorite).toHaveBeenCalledWith(2);
  });
});
