use serde::{Deserialize, Serialize};

/// Structured error kinds for Kubernetes API errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorKind {
    Forbidden,
    Unauthorized,
    NotFound,
    Conflict,
    RateLimited,
    ServerError,
    Network,
    Timeout,
    Unknown,
}

/// Structured error type for all Tauri commands.
///
/// Tauri serializes error types that implement `Serialize` as JSON objects,
/// so the frontend receives a parsed object instead of a plain string.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubeliError {
    pub kind: ErrorKind,
    pub code: Option<u16>,
    pub message: String,
    pub detail: Option<String>,
    pub resource: Option<String>,
    pub suggestions: Vec<String>,
    pub retryable: bool,
}

impl KubeliError {
    /// Create a new error with the given kind and message
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        let kind_clone = kind.clone();
        Self {
            retryable: is_retryable(&kind_clone),
            suggestions: suggestions_for(&kind_clone),
            kind,
            code: None,
            message: message.into(),
            detail: None,
            resource: None,
        }
    }

    /// Create a generic unknown error from any string
    pub fn unknown(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Unknown, message)
    }
}

impl std::fmt::Display for KubeliError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for KubeliError {}

impl From<String> for KubeliError {
    fn from(msg: String) -> Self {
        KubeliError::unknown(msg)
    }
}

impl From<&str> for KubeliError {
    fn from(msg: &str) -> Self {
        KubeliError::unknown(msg)
    }
}

impl From<std::io::Error> for KubeliError {
    fn from(err: std::io::Error) -> Self {
        let lower = err.to_string().to_lowercase();
        if lower.contains("timed out") || lower.contains("timeout") {
            KubeliError::new(ErrorKind::Timeout, format!("I/O timeout: {}", err))
        } else if lower.contains("connection refused") || lower.contains("network") {
            KubeliError::new(ErrorKind::Network, format!("Network error: {}", err))
        } else {
            KubeliError::unknown(format!("{}", err))
        }
    }
}

impl From<serde_json::Error> for KubeliError {
    fn from(err: serde_json::Error) -> Self {
        KubeliError::unknown(format!("JSON error: {}", err))
    }
}

impl From<serde_yaml::Error> for KubeliError {
    fn from(err: serde_yaml::Error) -> Self {
        KubeliError::unknown(format!("YAML error: {}", err))
    }
}

impl From<base64::DecodeError> for KubeliError {
    fn from(err: base64::DecodeError) -> Self {
        KubeliError::unknown(format!("Base64 decode error: {}", err))
    }
}

impl From<kube::runtime::watcher::Error> for KubeliError {
    fn from(err: kube::runtime::watcher::Error) -> Self {
        match err {
            kube::runtime::watcher::Error::WatchError(api_err) => {
                // WatchError wraps a kube::error::ErrorResponse directly
                let kube_err = kube::Error::Api(api_err);
                KubeliError::from(kube_err)
            }
            other => {
                let err_str = format!("{}", other);
                KubeliError::unknown(err_str)
            }
        }
    }
}

impl From<kube::Error> for KubeliError {
    fn from(err: kube::Error) -> Self {
        match &err {
            kube::Error::Api(api_err) => {
                let code = api_err.code;
                let (kind, message) = match code {
                    401 => (
                        ErrorKind::Unauthorized,
                        "Authentication failed — your credentials may have expired".to_string(),
                    ),
                    403 => (
                        ErrorKind::Forbidden,
                        format!(
                            "Access denied: {}",
                            api_err
                                .message
                                .split('\n')
                                .next()
                                .unwrap_or(&api_err.message)
                        ),
                    ),
                    404 => (
                        ErrorKind::NotFound,
                        format!("Resource not found: {}", api_err.reason),
                    ),
                    409 => (
                        ErrorKind::Conflict,
                        format!("Conflict: {}", api_err.message),
                    ),
                    429 => (
                        ErrorKind::RateLimited,
                        "Too many requests — the API server is rate limiting".to_string(),
                    ),
                    500..=599 => (
                        ErrorKind::ServerError,
                        format!("Server error ({}): {}", code, api_err.reason),
                    ),
                    _ => (
                        ErrorKind::Unknown,
                        format!("API error ({}): {}", code, api_err.message),
                    ),
                };

                let kind_clone = kind.clone();
                KubeliError {
                    retryable: is_retryable(&kind_clone),
                    suggestions: suggestions_for(&kind_clone),
                    kind,
                    code: Some(code),
                    message,
                    detail: Some(format!("{}", err)),
                    resource: None,
                }
            }
            _ => {
                // Network, timeout, and other errors
                let err_str = format!("{}", err);
                let lower = err_str.to_lowercase();

                let (kind, message) = if lower.contains("timeout")
                    || lower.contains("timed out")
                    || lower.contains("deadline")
                {
                    (
                        ErrorKind::Timeout,
                        "Request timed out — the cluster may be under heavy load".to_string(),
                    )
                } else if lower.contains("connection refused")
                    || lower.contains("dns")
                    || lower.contains("no such host")
                    || lower.contains("network")
                    || lower.contains("connect")
                    || lower.contains("hyper")
                    || lower.contains("tcp")
                {
                    (
                        ErrorKind::Network,
                        "Unable to connect to the cluster API server".to_string(),
                    )
                } else {
                    (ErrorKind::Unknown, format!("Kubernetes error: {}", err))
                };

                let kind_clone = kind.clone();
                KubeliError {
                    retryable: is_retryable(&kind_clone),
                    suggestions: suggestions_for(&kind_clone),
                    kind,
                    code: None,
                    message,
                    detail: Some(err_str),
                    resource: None,
                }
            }
        }
    }
}

impl From<anyhow::Error> for KubeliError {
    fn from(err: anyhow::Error) -> Self {
        // Try to downcast to kube::Error first
        // Try to downcast to kube::Error first
        match err.downcast::<kube::Error>() {
            Ok(kube_err) => kube_err.into(),
            Err(err) => KubeliError::unknown(format!("{}", err)),
        }
    }
}

fn is_retryable(kind: &ErrorKind) -> bool {
    matches!(
        kind,
        ErrorKind::Conflict
            | ErrorKind::RateLimited
            | ErrorKind::ServerError
            | ErrorKind::Network
            | ErrorKind::Timeout
            | ErrorKind::Unknown
    )
}

fn suggestions_for(kind: &ErrorKind) -> Vec<String> {
    match kind {
        ErrorKind::Forbidden => vec![
            "Check RBAC role assignments for your user".to_string(),
            "Contact your cluster admin to request access".to_string(),
            "Verify you have the correct namespace selected".to_string(),
        ],
        ErrorKind::Unauthorized => vec![
            "Your credentials may have expired — try reconnecting".to_string(),
            "Check if your kubeconfig token is still valid".to_string(),
        ],
        ErrorKind::NotFound => vec![
            "The resource may have been deleted".to_string(),
            "Check if the namespace exists".to_string(),
        ],
        ErrorKind::Network => vec![
            "Check your network connection".to_string(),
            "Verify the cluster API server is reachable".to_string(),
        ],
        ErrorKind::Timeout => vec![
            "The cluster may be under heavy load".to_string(),
            "Check network connectivity to the API server".to_string(),
        ],
        ErrorKind::RateLimited => vec!["Wait a moment before retrying".to_string()],
        ErrorKind::ServerError => vec![
            "The cluster API server may be experiencing issues".to_string(),
            "Check the cluster health and logs".to_string(),
        ],
        ErrorKind::Conflict | ErrorKind::Unknown => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::{ErrorKind, KubeliError};
    use base64::Engine;

    #[test]
    fn new_sets_retryable_and_suggestions_from_kind() {
        let forbidden = KubeliError::new(ErrorKind::Forbidden, "forbidden");
        assert!(!forbidden.retryable);
        assert_eq!(forbidden.suggestions.len(), 3);
        assert_eq!(forbidden.message, "forbidden");

        let timeout = KubeliError::new(ErrorKind::Timeout, "timed out");
        assert!(timeout.retryable);
        assert_eq!(timeout.suggestions.len(), 2);
    }

    #[test]
    fn unknown_uses_unknown_kind_defaults() {
        let err = KubeliError::unknown("boom");
        assert!(matches!(err.kind, ErrorKind::Unknown));
        assert!(err.retryable);
        assert!(err.suggestions.is_empty());
        assert_eq!(err.to_string(), "boom");
    }

    #[test]
    fn string_and_str_convert_to_unknown_errors() {
        let from_string: KubeliError = String::from("failure").into();
        let from_str: KubeliError = "another failure".into();

        assert!(matches!(from_string.kind, ErrorKind::Unknown));
        assert_eq!(from_string.message, "failure");
        assert!(matches!(from_str.kind, ErrorKind::Unknown));
        assert_eq!(from_str.message, "another failure");
    }

    #[test]
    fn io_errors_map_timeout_and_network_cases() {
        let timeout = std::io::Error::new(std::io::ErrorKind::TimedOut, "operation timed out");
        let timeout_err: KubeliError = timeout.into();
        assert!(matches!(timeout_err.kind, ErrorKind::Timeout));
        assert!(timeout_err.message.contains("I/O timeout"));

        let network =
            std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "connection refused");
        let network_err: KubeliError = network.into();
        assert!(matches!(network_err.kind, ErrorKind::Network));
        assert!(network_err.message.contains("Network error"));
    }

    #[test]
    fn serialization_related_errors_map_to_unknown() {
        let json_err = serde_json::from_str::<serde_json::Value>("{").unwrap_err();
        let json_kubeli: KubeliError = json_err.into();
        assert!(matches!(json_kubeli.kind, ErrorKind::Unknown));
        assert!(json_kubeli.message.starts_with("JSON error:"));

        let yaml_err = serde_yaml::from_str::<serde_yaml::Value>(": bad").unwrap_err();
        let yaml_kubeli: KubeliError = yaml_err.into();
        assert!(matches!(yaml_kubeli.kind, ErrorKind::Unknown));
        assert!(yaml_kubeli.message.starts_with("YAML error:"));

        let base64_err = base64::engine::general_purpose::STANDARD
            .decode("%%%")
            .unwrap_err();
        let base64_kubeli: KubeliError = base64_err.into();
        assert!(matches!(base64_kubeli.kind, ErrorKind::Unknown));
        assert!(base64_kubeli.message.starts_with("Base64 decode error:"));
    }

    #[test]
    fn anyhow_errors_fall_back_to_unknown_when_not_kube_errors() {
        let anyhow_err = anyhow::anyhow!("something failed");
        let kubeli: KubeliError = anyhow_err.into();

        assert!(matches!(kubeli.kind, ErrorKind::Unknown));
        assert_eq!(kubeli.message, "something failed");
    }
}
