import { render, screen } from "@testing-library/react";
import { EventsWarningBadge } from "../EventsTab";
import type { K8sEvent } from "../../types/constants";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/components/providers/I18nProvider", () => ({
  useLocale: () => "en",
}));

const event = (type: string): K8sEvent => ({
  type,
  reason: "Test",
  message: "m",
  count: 1,
});

describe("EventsWarningBadge", () => {
  it("renders nothing without warning events", () => {
    const { container } = render(<EventsWarningBadge events={[event("Normal"), event("Normal")]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the number of Warning events only", () => {
    render(
      <EventsWarningBadge events={[event("Warning"), event("Normal"), event("Warning")]} />
    );

    expect(screen.getByLabelText("2 warning events")).toHaveTextContent("2");
  });
});
