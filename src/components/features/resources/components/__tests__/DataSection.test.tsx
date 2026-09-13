import { render, screen, fireEvent, act } from "@testing-library/react";
import { DataSection, VIRTUALIZE_THRESHOLD } from "../DataSection";
import { parseSecretFromYaml } from "../../lib/utils";

jest.mock("../../lib/utils", () => {
  const actual = jest.requireActual("../../lib/utils");
  return { ...actual, parseSecretFromYaml: jest.fn(actual.parseSecretFromYaml) };
});

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/components/providers/I18nProvider", () => ({
  useLocale: () => "en",
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn() },
}));

jest.mock("../TlsCertificateView", () => ({
  TlsCertificateView: () => null,
}));

const secretYaml = [
  "apiVersion: v1",
  "kind: Secret",
  "type: Opaque",
  "data:",
  `  password: ${btoa("hunter2")}`,
  `  username: ${btoa("admin")}`,
  "",
].join("\n");

const configMapYaml = [
  "apiVersion: v1",
  "kind: ConfigMap",
  "data:",
  "  LOG_LEVEL: debug",
  "  app.conf: |",
  "    server.port=8080",
  "    feature.flag=true",
  "binaryData:",
  "  blob.bin: AAEC",
  "",
].join("\n");

const bigConfigMapYaml = (count: number) =>
  [
    "apiVersion: v1",
    "kind: ConfigMap",
    "data:",
    ...Array.from({ length: count }, (_, i) => `  key-${i}: value-${i}`),
    "",
  ].join("\n");

const rows = () => screen.queryAllByTestId("data-row");

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DataSection", () => {
  it("blurs secret values until revealed and copies the decoded value", async () => {
    render(<DataSection yaml={secretYaml} kind="secret" />);

    expect(screen.getByText("Opaque")).toBeInTheDocument();
    expect(screen.queryByText("hunter2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("reveal password"));
    expect(screen.getByText("hunter2")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("copy password"));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hunter2");
  });

  it("renders ConfigMap values as text with a wrap toggle and no reveal button", () => {
    render(<DataSection yaml={configMapYaml} kind="configmap" />);

    expect(screen.getByText("debug")).toBeInTheDocument();
    expect(screen.getByText(/server\.port=8080/)).toBeInTheDocument();
    expect(screen.getByText("configuration.binary")).toBeInTheDocument();
    expect(screen.queryByText("configuration.type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^reveal /)).not.toBeInTheDocument();

    const pre = screen.getByText("debug");
    expect(pre.className).toContain("whitespace-pre-wrap");
    fireEvent.click(screen.getByLabelText("logs.wrap"));
    expect(screen.getByText("debug").className).toContain("overflow-x-auto");
  });

  it("filters keys by the search box", () => {
    render(<DataSection yaml={configMapYaml} kind="configmap" />);
    expect(rows()).toHaveLength(3);

    fireEvent.change(screen.getByLabelText("common.search"), {
      target: { value: "LOG" },
    });
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("LOG_LEVEL")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("common.search"), {
      target: { value: "nothing" },
    });
    expect(rows()).toHaveLength(0);
    expect(screen.getByText("common.noResults")).toBeInTheDocument();
  });

  it("parses the YAML once across re-renders", () => {
    const spy = parseSecretFromYaml as jest.Mock;
    spy.mockClear();
    const { rerender } = render(<DataSection yaml={secretYaml} kind="secret" />);
    fireEvent.click(screen.getByLabelText("reveal password"));
    rerender(<DataSection yaml={secretYaml} kind="secret" />);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("windows the key list above the threshold", () => {
    // jsdom gives every element zero size; pretend the scroll container is
    // 600px tall so the virtualizer renders a window instead of nothing.
    jest.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);

    const count = VIRTUALIZE_THRESHOLD * 10;
    render(<DataSection yaml={bigConfigMapYaml(count)} kind="configmap" />);

    expect(screen.getByTestId("data-section-scroll")).toBeInTheDocument();
    const rendered = rows().length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(count / 4);
    expect(screen.getByText(`${count}/${count}`)).toBeInTheDocument();
  });

  it("renders the full list below the threshold", () => {
    render(<DataSection yaml={bigConfigMapYaml(VIRTUALIZE_THRESHOLD)} kind="configmap" />);
    expect(screen.queryByTestId("data-section-scroll")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(VIRTUALIZE_THRESHOLD);
  });
});
