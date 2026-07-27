//! X.509 certificate inspection for TLS secrets.
//!
//! Parsing happens in Rust rather than the frontend so the UI does not need an
//! ASN.1 library, and so a malformed certificate cannot take the renderer down.

use serde::{Deserialize, Serialize};
use tauri::command;
use x509_parser::prelude::*;

/// A parsed X.509 certificate, flattened for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateInfo {
    pub subject: String,
    /// Common Name pulled out of the subject, when present
    pub subject_common_name: Option<String>,
    pub issuer: String,
    pub issuer_common_name: Option<String>,
    /// Uppercase hex, colon-separated (`AB:CD:…`)
    pub serial_number: String,
    /// RFC 3339
    pub not_before: String,
    pub not_after: String,
    /// Negative once expired
    pub days_until_expiry: i64,
    pub is_expired: bool,
    /// True before not_before — a certificate issued for future use
    pub not_yet_valid: bool,
    pub signature_algorithm: String,
    /// Subject Alternative Names, already rendered (DNS names, IPs, URIs, emails)
    pub subject_alt_names: Vec<String>,
    pub is_ca: bool,
}

/// Result of inspecting one certificate chain (a `tls.crt` may hold several).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateChain {
    pub certificates: Vec<CertificateInfo>,
    /// Set when the PEM could not be parsed at all
    pub error: Option<String>,
}

/// Renders an RDN sequence as a comma-separated string (`CN=example.com, O=Acme`).
fn format_name(name: &X509Name) -> String {
    name.iter_rdn()
        .flat_map(|rdn| rdn.iter())
        .filter_map(|attr| {
            let key = oid2abbrev(attr.attr_type(), oid_registry())
                .map(|s| s.to_string())
                .unwrap_or_else(|_| attr.attr_type().to_id_string());
            attr.as_str().ok().map(|value| format!("{}={}", key, value))
        })
        .collect::<Vec<_>>()
        .join(", ")
}

/// Extracts a single attribute (by OID abbreviation, e.g. "CN") from a name.
fn extract_attr(name: &X509Name, abbrev: &str) -> Option<String> {
    name.iter_rdn()
        .flat_map(|rdn| rdn.iter())
        .find(|attr| {
            oid2abbrev(attr.attr_type(), oid_registry())
                .map(|s| s == abbrev)
                .unwrap_or(false)
        })
        .and_then(|attr| attr.as_str().ok().map(|s| s.to_string()))
}

/// Renders SAN entries. IP addresses arrive as raw octets and are formatted as
/// readable v4/v6 addresses rather than hex.
fn format_san(name: &GeneralName) -> Option<String> {
    match name {
        GeneralName::DNSName(s) => Some(format!("DNS:{}", s)),
        GeneralName::RFC822Name(s) => Some(format!("email:{}", s)),
        GeneralName::URI(s) => Some(format!("URI:{}", s)),
        GeneralName::IPAddress(bytes) => match bytes.len() {
            4 => Some(format!(
                "IP:{}.{}.{}.{}",
                bytes[0], bytes[1], bytes[2], bytes[3]
            )),
            16 => {
                // std's Display gives RFC 5952 zero compression (2001:db8::1)
                let mut octets = [0u8; 16];
                octets.copy_from_slice(bytes);
                Some(format!("IP:{}", std::net::Ipv6Addr::from(octets)))
            }
            _ => None,
        },
        _ => None,
    }
}

/// Formats an epoch second as RFC 3339 for the frontend to localize.
fn format_timestamp(epoch_seconds: i64) -> String {
    chrono::DateTime::from_timestamp(epoch_seconds, 0)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default()
}

fn to_info(cert: &X509Certificate) -> CertificateInfo {
    let not_before = cert.validity().not_before;
    let not_after = cert.validity().not_after;

    // Compare in epoch seconds: x509-parser's timestamps and chrono agree there,
    // so no conversion between two date libraries is needed.
    let now = chrono::Utc::now().timestamp();
    let expires_at = not_after.timestamp();
    let days_until_expiry = (expires_at - now) / 86_400;

    let serial_number = cert
        .raw_serial()
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(":");

    let subject_alt_names = cert
        .subject_alternative_name()
        .ok()
        .flatten()
        .map(|san| {
            san.value
                .general_names
                .iter()
                .filter_map(format_san)
                .collect()
        })
        .unwrap_or_default();

    CertificateInfo {
        subject: format_name(cert.subject()),
        subject_common_name: extract_attr(cert.subject(), "CN"),
        issuer: format_name(cert.issuer()),
        issuer_common_name: extract_attr(cert.issuer(), "CN"),
        serial_number,
        not_before: format_timestamp(not_before.timestamp()),
        not_after: format_timestamp(expires_at),
        days_until_expiry,
        is_expired: expires_at <= now,
        not_yet_valid: not_before.timestamp() > now,
        signature_algorithm: oid2sn(&cert.signature_algorithm.algorithm, oid_registry())
            .map(|s| s.to_string())
            .unwrap_or_else(|_| cert.signature_algorithm.algorithm.to_id_string()),
        subject_alt_names,
        is_ca: cert.is_ca(),
    }
}

/// Parses a PEM-encoded certificate (or chain) into displayable metadata.
///
/// Chains are common in `tls.crt`: leaf first, then intermediates.
#[command]
pub fn parse_certificate(pem: String) -> CertificateChain {
    let mut certificates = Vec::new();
    let mut last_error = None;

    for pem_block in Pem::iter_from_buffer(pem.as_bytes()) {
        match pem_block {
            Ok(block) => match block.parse_x509() {
                Ok(cert) => certificates.push(to_info(&cert)),
                Err(e) => last_error = Some(format!("Invalid certificate: {}", e)),
            },
            Err(e) => last_error = Some(format!("Invalid PEM data: {}", e)),
        }
    }

    CertificateChain {
        // Only surface an error when nothing could be read; a chain whose
        // trailing entry is broken is still worth showing.
        error: if certificates.is_empty() {
            Some(last_error.unwrap_or_else(|| "No certificate found".to_string()))
        } else {
            None
        },
        certificates,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Self-signed test certificate: CN=kubeli.test, SAN DNS:kubeli.test,
    // DNS:*.kubeli.test, IP:127.0.0.1
    const TEST_CERT: &str = include_str!("../../test-data/tls-test-cert.pem");

    #[test]
    fn parses_subject_and_issuer() {
        let result = parse_certificate(TEST_CERT.to_string());
        assert!(
            result.error.is_none(),
            "unexpected error: {:?}",
            result.error
        );
        assert_eq!(result.certificates.len(), 1);

        let cert = &result.certificates[0];
        assert_eq!(cert.subject_common_name.as_deref(), Some("kubeli.test"));
        assert!(cert.subject.contains("CN=kubeli.test"));
        assert!(cert.issuer.contains("CN="));
    }

    #[test]
    fn formats_serial_as_colon_separated_hex() {
        let cert = &parse_certificate(TEST_CERT.to_string()).certificates[0];
        assert!(
            cert.serial_number
                .split(':')
                .all(|b| b.len() == 2 && b.chars().all(|c| c.is_ascii_hexdigit())),
            "unexpected serial: {}",
            cert.serial_number
        );
    }

    #[test]
    fn renders_ip_sans_readably() {
        let cert = &parse_certificate(TEST_CERT.to_string()).certificates[0];
        // The whole point of the issue: no hex blobs
        assert!(
            cert.subject_alt_names.contains(&"IP:127.0.0.1".to_string()),
            "SANs: {:?}",
            cert.subject_alt_names
        );
        assert!(cert
            .subject_alt_names
            .contains(&"DNS:kubeli.test".to_string()));
    }

    #[test]
    fn reports_expiry() {
        let cert = &parse_certificate(TEST_CERT.to_string()).certificates[0];
        // Fixture is long-lived; if this ever fails, regenerate it
        assert!(!cert.is_expired, "test fixture expired, regenerate it");
        assert!(cert.days_until_expiry > 0);
        assert!(!cert.not_yet_valid);
    }

    #[test]
    fn reports_signature_algorithm() {
        let cert = &parse_certificate(TEST_CERT.to_string()).certificates[0];
        assert!(!cert.signature_algorithm.is_empty());
        // Should be a name, not a raw dotted OID
        assert!(!cert.signature_algorithm.starts_with('1'));
    }

    #[test]
    fn returns_error_for_garbage() {
        let result = parse_certificate("not a certificate".to_string());
        assert!(result.certificates.is_empty());
        assert!(result.error.is_some());
    }

    #[test]
    fn returns_error_for_empty_input() {
        let result = parse_certificate(String::new());
        assert!(result.certificates.is_empty());
        assert!(result.error.is_some());
    }

    #[test]
    fn parses_every_certificate_in_a_chain() {
        let chain = format!("{}\n{}", TEST_CERT, TEST_CERT);
        let result = parse_certificate(chain);
        assert!(result.error.is_none());
        assert_eq!(result.certificates.len(), 2);
    }

    #[test]
    fn ipv6_sans_are_rfc5952_compressed() {
        let bytes: [u8; 16] = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
        let san = format_san(&GeneralName::IPAddress(&bytes)).expect("valid IPv6 SAN");
        assert_eq!(san, "IP:2001:db8::1", "zero runs must be compressed");
    }
}
