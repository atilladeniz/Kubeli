import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AnnotationsSection } from "../AnnotationsSection";

jest.mock("sonner", () => ({
  toast: { success: jest.fn() },
}));

const renderSection = (annotations: Record<string, string>) =>
  render(
    <AnnotationsSection
      annotations={annotations}
      label="Annotations"
      copyToastMessage="Copied"
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AnnotationsSection", () => {
  it("renders a URL-valued annotation as a link that opens the system browser", async () => {
    renderSection({
      "example.com/docs-url": "https://example.com/docs",
    });

    const link = screen.getByRole("button", {
      name: "https://example.com/docs",
    });
    fireEvent.click(link);

    await waitFor(() => {
      expect(openUrl).toHaveBeenCalledWith("https://example.com/docs");
    });
  });

  it("trims surrounding whitespace before opening the URL", async () => {
    renderSection({
      "example.com/docs-url": "  https://example.com/docs  ",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "https://example.com/docs" }),
    );

    await waitFor(() => {
      expect(openUrl).toHaveBeenCalledWith("https://example.com/docs");
    });
  });

  it("renders a non-URL value as plain text", () => {
    renderSection({
      "example.com/description": "just a plain value",
    });

    const value = screen.getByText("just a plain value");
    expect(value.tagName).toBe("P");
    expect(
      screen.queryByRole("button", { name: "just a plain value" }),
    ).not.toBeInTheDocument();
  });

  it("does not linkify URLs embedded in longer text", () => {
    renderSection({
      "example.com/mixed": "see https://example.com/docs for details",
    });

    const value = screen.getByText("see https://example.com/docs for details");
    expect(value.tagName).toBe("P");
  });

  it("keeps copy-to-clipboard working for URL values", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { container } = renderSection({
      "example.com/docs-url": "https://example.com/docs",
    });

    const copyButton = container.querySelector("button[data-slot='button']");
    expect(copyButton).not.toBeNull();
    fireEvent.click(copyButton!);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://example.com/docs");
    });
    expect(openUrl).not.toHaveBeenCalled();
  });
});
