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

    /// Set the resource name this error relates to
    pub fn with_resource(mut self, resource: impl Into<String>) -> Self {
        self.resource = Some(resource.into());
        self
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
