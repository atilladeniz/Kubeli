import { render, screen } from "@testing-library/react";
import { ChatInput } from "../ChatInput";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// The toolbar loads model catalogs from the CLI; keep them pending here.
jest.mock("@/lib/tauri/commands/ai", () => ({
  aiListModels: jest.fn(() => new Promise(() => {})),
}));

describe("ChatInput", () => {
  // The shared Textarea adds an inset shadow (also a dark: variant). Inside the
  // chat composer it drew a box within the box, so both must be cleared.
  it("drops the Textarea inset shadow in light and dark mode", () => {
    render(
      <ChatInput
        value=""
        onChange={() => {}}
        onSend={() => {}}
        onInterrupt={() => {}}
        placeholder="Ask"
        isStreaming={false}
        isThinking={false}
      />
    );
    expect(screen.getByPlaceholderText("Ask").className).not.toMatch(/shadow-\[inset/);
  });
});
