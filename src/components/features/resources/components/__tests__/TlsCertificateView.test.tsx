import { render, screen, waitFor } from "@testing-library/react";
import { TlsCertificateView } from "../TlsCertificateView";
import { parseCertificate } from "@/lib/tauri/commands";
import type { CertificateInfo } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

jest.mock("@/components/providers/I18nProvider", () => ({
  useLocale: () => "en",
}));

jest.mock("@/lib/tauri/commands", () => ({
  parseCertificate: jest.fn(),
}));

const mockParseCertificate = parseCertificate as jest.MockedFunction<typeof parseCertificate>;

const cert = (overrides: Partial<CertificateInfo> = {}): CertificateInfo => ({
  subject: "CN=kubeli.test, O=Kubeli",
  subject_common_name: "kubeli.test",
  issuer: "CN=Kubeli CA",
  issuer_common_name: "Kubeli CA",
  serial_number: "4A:2B:1C",
  not_before: "2024-01-01T00:00:00Z",
  not_after: "2030-01-01T00:00:00Z",
  days_until_expiry: 900,
  is_expired: false,
  not_yet_valid: false,
  signature_algorithm: "sha256WithRSAEncryption",
  subject_alt_names: ["DNS:kubeli.test", "IP:127.0.0.1"],
  is_ca: false,
  ...overrides,
});

const resolveWith = (certificates: CertificateInfo[], error: string | null = null) =>
  mockParseCertificate.mockResolvedValue({ certificates, error });

describe("TlsCertificateView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows subject, issuer, serial and algorithm", async () => {
    resolveWith([cert()]);
    render(<TlsCertificateView pem="PEM" />);

    await screen.findByText("CN=kubeli.test, O=Kubeli");
    expect(screen.getByText("CN=Kubeli CA")).toBeInTheDocument();
    expect(screen.getByText("4A:2B:1C")).toBeInTheDocument();
    expect(screen.getByText("sha256WithRSAEncryption")).toBeInTheDocument();
  });

  // The whole point of the issue: IPs readable, not hex blobs
  it("lists subject alternative names", async () => {
    resolveWith([cert()]);
    render(<TlsCertificateView pem="PEM" />);

    await screen.findByText("DNS:kubeli.test");
    expect(screen.getByText("IP:127.0.0.1")).toBeInTheDocument();
  });

  it("marks a healthy certificate as valid", async () => {
    resolveWith([cert()]);
    render(<TlsCertificateView pem="PEM" />);

    expect(await screen.findByText("secrets.certValid")).toBeInTheDocument();
  });

  it("warns when expiry is within 30 days", async () => {
    resolveWith([cert({ days_until_expiry: 12 })]);
    render(<TlsCertificateView pem="PEM" />);

    expect(
      await screen.findByText('secrets.certExpiresInDays:{"days":12}')
    ).toBeInTheDocument();
  });

  it("still warns on the 30-day boundary", async () => {
    resolveWith([cert({ days_until_expiry: 30 })]);
    render(<TlsCertificateView pem="PEM" />);

    expect(
      await screen.findByText('secrets.certExpiresInDays:{"days":30}')
    ).toBeInTheDocument();
  });

  // Under 24h the day count is 0 — "expires in 0 days" reads like a bug
  it("says expires today instead of 0 days", async () => {
    resolveWith([cert({ days_until_expiry: 0 })]);
    render(<TlsCertificateView pem="PEM" />);

    expect(await screen.findByText("secrets.certExpiresToday")).toBeInTheDocument();
  });

  it("flags an expired certificate", async () => {
    resolveWith([cert({ is_expired: true, days_until_expiry: -5 })]);
    render(<TlsCertificateView pem="PEM" />);

    expect(await screen.findByText("secrets.certExpired")).toBeInTheDocument();
  });

  it("flags a certificate that is not yet valid", async () => {
    resolveWith([cert({ not_yet_valid: true })]);
    render(<TlsCertificateView pem="PEM" />);

    expect(await screen.findByText("secrets.certNotYetValid")).toBeInTheDocument();
  });

  it("marks CA certificates", async () => {
    resolveWith([cert({ is_ca: true })]);
    render(<TlsCertificateView pem="PEM" />);

    expect(await screen.findByText("CA")).toBeInTheDocument();
  });

  it("labels chain position only when there is a chain", async () => {
    resolveWith([cert()]);
    const { unmount } = render(<TlsCertificateView pem="PEM" />);
    await screen.findByText("secrets.certValid");
    expect(screen.queryByText("secrets.certLeaf")).toBeNull();
    unmount();

    resolveWith([cert(), cert({ serial_number: "99:88", is_ca: true })]);
    render(<TlsCertificateView pem="PEM" />);

    expect(await screen.findByText("secrets.certLeaf")).toBeInTheDocument();
    expect(screen.getByText("secrets.certIntermediate")).toBeInTheDocument();
  });

  it("reports a parse error instead of rendering nothing", async () => {
    resolveWith([], "Invalid PEM data");
    render(<TlsCertificateView pem="garbage" />);

    expect(await screen.findByText("secrets.certParseError")).toBeInTheDocument();
  });

  it("renders nothing when the chain is empty and no error is reported", async () => {
    resolveWith([]);
    const { container } = render(<TlsCertificateView pem="PEM" />);

    await waitFor(() => expect(mockParseCertificate).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("surfaces a rejected invoke as a parse error", async () => {
    mockParseCertificate.mockRejectedValue(new Error("backend down"));
    render(<TlsCertificateView pem="PEM" />);

    expect(await screen.findByText("secrets.certParseError")).toBeInTheDocument();
  });
});
