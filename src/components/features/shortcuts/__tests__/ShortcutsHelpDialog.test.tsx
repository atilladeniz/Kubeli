import { render, screen } from "@testing-library/react";
import { ShortcutsHelpDialog } from "../ShortcutsHelpDialog";
import { DASHBOARD_SHORTCUTS } from "@/components/features/dashboard/shortcuts";

jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

jest.mock("@/lib/hooks/usePlatform", () => ({
  usePlatform: () => ({ modKey: "⌘" }),
}));

describe("ShortcutsHelpDialog", () => {
  it("renders one row per visible registry entry", () => {
    render(<ShortcutsHelpDialog open onOpenChange={() => {}} />);

    const visible = DASHBOARD_SHORTCUTS.filter((s) => !s.helpHidden);
    for (const s of visible) {
      const text = s.navKey ? `shortcuts.goTo navigation.${s.navKey}` : `shortcuts.${s.labelKey}`;
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    // Entries the old hardcoded list forgot
    expect(screen.getByText("shortcuts.toggleAI")).toBeTruthy();
    expect(screen.getByText("1-9")).toBeTruthy();
    expect(screen.getByText("shortcuts.nextTab")).toBeTruthy();
  });
});
