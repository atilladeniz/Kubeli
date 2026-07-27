import { invoke } from "@tauri-apps/api/core";
import type { CertificateChain } from "@/lib/types";

/**
 * Parses a PEM-encoded certificate or chain into displayable metadata.
 * Never rejects on malformed input — the error is reported in the result.
 */
export async function parseCertificate(pem: string): Promise<CertificateChain> {
  return invoke<CertificateChain>("parse_certificate", { pem });
}
