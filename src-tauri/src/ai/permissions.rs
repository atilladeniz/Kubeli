use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::{oneshot, RwLock};

/// Permission modes for AI agent operations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PermissionMode {
    /// Plan mode: Agent proposes commands, user must approve all tool executions
    Plan,
    /// Default mode: Safe commands (get, describe, logs) auto-execute,
    /// destructive commands (delete, apply, patch) require approval
    #[default]
    Default,
    /// AcceptEdits mode: Full autonomy for sandboxed namespaces only
    AcceptEdits,
}

/// Result of a permission check (for future tool-level integration)
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum PermissionCheckResult {
    /// Command is allowed to execute
    Allowed,
    /// Command requires user approval
    RequiresApproval {
        reason: String,
        command_preview: String,
        severity: CommandSeverity,
    },
    /// Command is blocked entirely
    Blocked { reason: String },
}

/// Severity level of potentially dangerous commands
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CommandSeverity {
    /// Low risk - informational changes
    Low,
    /// Medium risk - resource modifications
    Medium,
    /// High risk - destructive operations
    High,
    /// Critical - cluster-wide impact
    Critical,
}

/// Approval request sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub request_id: String,
    pub session_id: String,
    pub tool_name: String,
    pub tool_input: serde_json::Value,
    pub command_preview: String,
    pub reason: String,
    pub severity: CommandSeverity,
}

/// Approval response from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalResponse {
    pub request_id: String,
    pub approved: bool,
    pub reason: Option<String>,
}

/// Pending approval with response channel
struct PendingApproval {
    request: ApprovalRequest,
    response_tx: oneshot::Sender<ApprovalResponse>,
}

/// Permission checker for AI tool executions
pub struct PermissionChecker {
    /// Current permission mode
    mode: RwLock<PermissionMode>,
    /// Sandboxed namespaces for AcceptEdits mode
    sandboxed_namespaces: RwLock<HashSet<String>>,
    /// Restricted namespaces (never allow destructive operations)
    #[allow(dead_code)]
    restricted_namespaces: HashSet<String>,
    /// Pending approval requests
    pending_approvals: RwLock<std::collections::HashMap<String, PendingApproval>>,
    /// Dangerous command patterns (for future tool-level integration)
    #[allow(dead_code)]
    dangerous_patterns: DangerousPatterns,
}

/// Compiled regex patterns for dangerous operations (for future tool-level integration)
#[allow(dead_code)]
struct DangerousPatterns {
    /// kubectl delete patterns
    delete_pattern: Regex,
    /// kubectl apply/create patterns
    apply_pattern: Regex,
    /// kubectl patch/edit patterns
    modify_pattern: Regex,
    /// kubectl scale patterns
    scale_pattern: Regex,
    /// kubectl drain/cordon patterns
    node_pattern: Regex,
    /// kubectl exec patterns
    exec_pattern: Regex,
    /// rm -rf and destructive shell patterns
    shell_destructive: Regex,
    /// Cluster-scoped resource patterns
    cluster_scoped: Regex,
}

impl DangerousPatterns {
    fn new() -> Self {
        Self {
            delete_pattern: Regex::new(r"(?i)\bkubectl\s+delete\b").unwrap(),
            apply_pattern: Regex::new(r"(?i)\bkubectl\s+(apply|create)\b").unwrap(),
            modify_pattern: Regex::new(r"(?i)\bkubectl\s+(patch|edit|replace|set)\b").unwrap(),
            scale_pattern: Regex::new(r"(?i)\bkubectl\s+scale\b").unwrap(),
            node_pattern: Regex::new(r"(?i)\bkubectl\s+(drain|cordon|uncordon|taint)\b").unwrap(),
            exec_pattern: Regex::new(r"(?i)\bkubectl\s+exec\b").unwrap(),
            shell_destructive: Regex::new(r"(?i)\brm\s+(-rf?|--force|-r\s+-f)\b").unwrap(),
            cluster_scoped: Regex::new(
                r"(?i)\b(clusterrole|clusterrolebinding|node|namespace|persistentvolume|storageclass)\b",
            )
            .unwrap(),
        }
    }

    /// Check if command contains dangerous patterns
    fn analyze_command(&self, command: &str) -> Option<(CommandSeverity, String)> {
        // Critical: Node operations, cluster-scoped deletes
        if self.node_pattern.is_match(command) {
            return Some((
                CommandSeverity::Critical,
                "Node operation detected (drain/cordon/taint)".to_string(),
            ));
        }

        if self.delete_pattern.is_match(command) && self.cluster_scoped.is_match(command) {
            return Some((
                CommandSeverity::Critical,
                "Cluster-scoped resource deletion detected".to_string(),
            ));
        }

        // High: Delete operations, shell destructive commands
        if self.delete_pattern.is_match(command) {
            return Some((
                CommandSeverity::High,
                "Resource deletion detected".to_string(),
            ));
        }

        if self.shell_destructive.is_match(command) {
            return Some((
                CommandSeverity::High,
                "Destructive shell command detected".to_string(),
            ));
        }

        // Medium: Apply, create, modify operations
        if self.apply_pattern.is_match(command) {
            return Some((
                CommandSeverity::Medium,
                "Resource creation/update detected".to_string(),
            ));
        }

        if self.modify_pattern.is_match(command) {
            return Some((
                CommandSeverity::Medium,
                "Resource modification detected".to_string(),
            ));
        }

        if self.scale_pattern.is_match(command) {
            return Some((
                CommandSeverity::Medium,
                "Scaling operation detected".to_string(),
            ));
        }

        // Low: Exec commands (potentially risky but often needed)
        if self.exec_pattern.is_match(command) {
            return Some((CommandSeverity::Low, "Container exec detected".to_string()));
        }

        None
    }
}

impl PermissionChecker {
    pub fn new() -> Self {
        let mut restricted = HashSet::new();
        restricted.insert("kube-system".to_string());
        restricted.insert("kube-public".to_string());
        restricted.insert("kube-node-lease".to_string());

        Self {
            mode: RwLock::new(PermissionMode::Default),
            sandboxed_namespaces: RwLock::new(HashSet::new()),
            restricted_namespaces: restricted,
            pending_approvals: RwLock::new(std::collections::HashMap::new()),
            dangerous_patterns: DangerousPatterns::new(),
        }
    }

    /// Get current permission mode
    pub async fn get_mode(&self) -> PermissionMode {
        *self.mode.read().await
    }

    /// Set permission mode
    pub async fn set_mode(&self, mode: PermissionMode) {
        *self.mode.write().await = mode;
        tracing::info!("Permission mode set to {:?}", mode);
    }

    /// Add a sandboxed namespace for AcceptEdits mode
    pub async fn add_sandboxed_namespace(&self, namespace: String) {
        self.sandboxed_namespaces.write().await.insert(namespace);
    }

    /// Remove a sandboxed namespace
    pub async fn remove_sandboxed_namespace(&self, namespace: &str) {
        self.sandboxed_namespaces.write().await.remove(namespace);
    }

    /// Get sandboxed namespaces
    pub async fn get_sandboxed_namespaces(&self) -> Vec<String> {
        self.sandboxed_namespaces
            .read()
            .await
            .iter()
            .cloned()
            .collect()
    }

    /// Check if a namespace is restricted (for future tool-level integration)
    #[allow(dead_code)]
    pub fn is_restricted_namespace(&self, namespace: &str) -> bool {
        self.restricted_namespaces.contains(namespace)
    }

    /// Extract namespace from kubectl command if present (for future tool-level integration)
    #[allow(dead_code)]
    fn extract_namespace(&self, command: &str) -> Option<String> {
        // Match -n or --namespace followed by the namespace name
        let ns_pattern = Regex::new(r"(?:-n|--namespace)[=\s]+([a-zA-Z0-9_-]+)").unwrap();
        ns_pattern
            .captures(command)
            .map(|c| c.get(1).unwrap().as_str().to_string())
    }

    /// Check if a tool execution is allowed (for future tool-level integration)
    #[allow(dead_code)]
    pub async fn check_tool_use(
        &self,
        tool_name: &str,
        tool_input: &serde_json::Value,
    ) -> PermissionCheckResult {
        let mode = self.get_mode().await;

        // Extract command from tool input
        let command = self.extract_command_from_input(tool_name, tool_input);

        // Plan mode: everything requires approval
        if mode == PermissionMode::Plan {
            return PermissionCheckResult::RequiresApproval {
                reason: "Plan mode: All tool executions require approval".to_string(),
                command_preview: command.clone().unwrap_or_else(|| tool_name.to_string()),
                severity: CommandSeverity::Low,
            };
        }

        // Check for dangerous patterns
        if let Some(ref cmd) = command {
            // Check for restricted namespaces
            if let Some(ns) = self.extract_namespace(cmd) {
                if self.is_restricted_namespace(&ns) {
                    if let Some((severity, _)) = self.dangerous_patterns.analyze_command(cmd) {
                        if severity >= CommandSeverity::Medium {
                            return PermissionCheckResult::Blocked {
                                reason: format!(
                                    "Operations in restricted namespace '{}' are not allowed",
                                    ns
                                ),
                            };
                        }
                    }
                }
            }

            // Analyze command for dangerous patterns
            if let Some((severity, reason)) = self.dangerous_patterns.analyze_command(cmd) {
                match mode {
                    PermissionMode::Default => {
                        // Default mode: Medium+ severity requires approval
                        if severity >= CommandSeverity::Medium {
                            return PermissionCheckResult::RequiresApproval {
                                reason,
                                command_preview: cmd.clone(),
                                severity,
                            };
                        }
                    }
                    PermissionMode::AcceptEdits => {
                        // AcceptEdits mode: Only allow in sandboxed namespaces
                        if let Some(ns) = self.extract_namespace(cmd) {
                            let sandboxed = self.sandboxed_namespaces.read().await;
                            if !sandboxed.contains(&ns) && severity >= CommandSeverity::Medium {
                                return PermissionCheckResult::RequiresApproval {
                                    reason: format!(
                                        "{} - Namespace '{}' is not sandboxed",
                                        reason, ns
                                    ),
                                    command_preview: cmd.clone(),
                                    severity,
                                };
                            }
                        } else if severity >= CommandSeverity::High {
                            // No namespace specified for high severity - require approval
                            return PermissionCheckResult::RequiresApproval {
                                reason: format!("{} - No namespace specified", reason),
                                command_preview: cmd.clone(),
                                severity,
                            };
                        }
                    }
                    PermissionMode::Plan => unreachable!(), // Handled above
                }
            }
        }

        PermissionCheckResult::Allowed
    }

    /// Extract command string from tool input (for future tool-level integration)
    #[allow(dead_code)]
    fn extract_command_from_input(
        &self,
        tool_name: &str,
        input: &serde_json::Value,
    ) -> Option<String> {
        // Handle Bash tool
        if tool_name.to_lowercase() == "bash" || tool_name.to_lowercase() == "execute_command" {
            if let Some(cmd) = input.get("command").and_then(|v| v.as_str()) {
                return Some(cmd.to_string());
            }
        }

        // Handle other tool types - try common field names
        for field in ["command", "cmd", "script", "code"] {
            if let Some(cmd) = input.get(field).and_then(|v| v.as_str()) {
                return Some(cmd.to_string());
            }
        }

        // Fallback: serialize the input for display
        Some(format!("{}({})", tool_name, input))
    }

    /// Create an approval request and wait for response (for future tool-level integration)
    #[allow(dead_code)]
    pub async fn request_approval(
        &self,
        session_id: String,
        tool_name: String,
        tool_input: serde_json::Value,
        command_preview: String,
        reason: String,
        severity: CommandSeverity,
    ) -> Result<ApprovalResponse, String> {
        let request_id = uuid::Uuid::new_v4().to_string();

        let (response_tx, response_rx) = oneshot::channel();

        let request = ApprovalRequest {
            request_id: request_id.clone(),
            session_id,
            tool_name,
            tool_input,
            command_preview,
            reason,
            severity,
        };

        // Store pending approval
        {
            let mut pending = self.pending_approvals.write().await;
            pending.insert(
                request_id.clone(),
                PendingApproval {
                    request: request.clone(),
                    response_tx,
                },
            );
        }

        // Wait for response with timeout
        match tokio::time::timeout(std::time::Duration::from_secs(60), response_rx).await {
            Ok(Ok(response)) => {
                // Clean up
                self.pending_approvals.write().await.remove(&request_id);
                Ok(response)
            }
            Ok(Err(_)) => {
                self.pending_approvals.write().await.remove(&request_id);
                Err("Approval channel closed unexpectedly".to_string())
            }
            Err(_) => {
                self.pending_approvals.write().await.remove(&request_id);
                Err("Approval request timed out after 60 seconds".to_string())
            }
        }
    }

    /// Get pending approval request (for future tool-level integration)
    #[allow(dead_code)]
    pub async fn get_pending_approval(&self, request_id: &str) -> Option<ApprovalRequest> {
        let pending = self.pending_approvals.read().await;
        pending.get(request_id).map(|p| p.request.clone())
    }

    /// List all pending approval requests
    pub async fn list_pending_approvals(&self) -> Vec<ApprovalRequest> {
        let pending = self.pending_approvals.read().await;
        pending.values().map(|p| p.request.clone()).collect()
    }

    /// Submit approval response
    pub async fn submit_approval(
        &self,
        request_id: &str,
        approved: bool,
        reason: Option<String>,
    ) -> Result<(), String> {
        let mut pending = self.pending_approvals.write().await;
        if let Some(approval) = pending.remove(request_id) {
            let response = ApprovalResponse {
                request_id: request_id.to_string(),
                approved,
                reason,
            };
            approval
                .response_tx
                .send(response)
                .map_err(|_| "Failed to send approval response".to_string())
        } else {
            Err(format!(
                "No pending approval found for request {}",
                request_id
            ))
        }
    }
}

impl Default for PermissionChecker {
    fn default() -> Self {
        Self::new()
    }
}

// Allow comparing severity levels
impl PartialOrd for CommandSeverity {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for CommandSeverity {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        let self_val = match self {
            CommandSeverity::Low => 0,
            CommandSeverity::Medium => 1,
            CommandSeverity::High => 2,
            CommandSeverity::Critical => 3,
        };
        let other_val = match other {
            CommandSeverity::Low => 0,
            CommandSeverity::Medium => 1,
            CommandSeverity::High => 2,
            CommandSeverity::Critical => 3,
        };
        self_val.cmp(&other_val)
    }
}

/// Thread-safe wrapper for PermissionChecker
pub type SharedPermissionChecker = Arc<PermissionChecker>;

/// Create a new shared permission checker
pub fn create_permission_checker() -> SharedPermissionChecker {
    Arc::new(PermissionChecker::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dangerous_patterns() {
        let patterns = DangerousPatterns::new();

        // Test delete pattern
        assert!(patterns
            .analyze_command("kubectl delete pod nginx")
            .is_some());
        assert!(patterns
            .analyze_command("kubectl DELETE deployment app")
            .is_some());

        // Test apply pattern
        assert!(patterns
            .analyze_command("kubectl apply -f manifest.yaml")
            .is_some());
        assert!(patterns
            .analyze_command("kubectl create configmap test")
            .is_some());

        // Test node operations (critical)
        let result = patterns.analyze_command("kubectl drain node-1");
        assert!(matches!(result, Some((CommandSeverity::Critical, _))));

        // Test safe operations
        assert!(patterns.analyze_command("kubectl get pods").is_none());
        assert!(patterns
            .analyze_command("kubectl describe pod nginx")
            .is_none());
        assert!(patterns.analyze_command("kubectl logs nginx").is_none());
    }

    #[test]
    fn test_namespace_extraction() {
        let checker = PermissionChecker::new();

        assert_eq!(
            checker.extract_namespace("kubectl delete pod nginx -n production"),
            Some("production".to_string())
        );
        assert_eq!(
            checker.extract_namespace("kubectl get pods --namespace=kube-system"),
            Some("kube-system".to_string())
        );
        assert_eq!(checker.extract_namespace("kubectl get pods"), None);
    }
}
