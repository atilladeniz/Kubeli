use crate::k8s::AppState;
use k8s_openapi::api::core::v1::{Namespace, Node, Pod};
use kube::api::ListParams;
use kube::Api;
use serde::{Deserialize, Serialize};

/// Cluster context information for AI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterContext {
    /// Cluster name/context
    pub context_name: String,
    /// Kubernetes version
    pub kubernetes_version: Option<String>,
    /// Cluster platform (detected from node labels)
    pub platform: Option<String>,
    /// Number of nodes
    pub node_count: usize,
    /// Number of namespaces
    pub namespace_count: usize,
    /// Number of running pods
    pub running_pods: usize,
    /// Number of failed/pending pods
    pub problem_pods: usize,
    /// Current namespace (if set)
    pub current_namespace: Option<String>,
    /// Recent warnings/issues
    pub recent_issues: Vec<String>,
}

impl ClusterContext {
    /// Generate a system prompt from the context
    pub fn to_system_prompt(&self) -> String {
        let mut prompt = format!(
            r#"You are an AI assistant helping manage a Kubernetes cluster.

## Cluster Information
- **Context**: {}
"#,
            self.context_name
        );

        if let Some(version) = &self.kubernetes_version {
            prompt.push_str(&format!("- **Kubernetes Version**: {}\n", version));
        }

        if let Some(platform) = &self.platform {
            prompt.push_str(&format!("- **Platform**: {}\n", platform));
        }

        prompt.push_str(&format!(
            r#"- **Nodes**: {}
- **Namespaces**: {}
- **Running Pods**: {}
"#,
            self.node_count, self.namespace_count, self.running_pods
        ));

        if self.problem_pods > 0 {
            prompt.push_str(&format!(
                "- **Problem Pods**: {} (requires attention)\n",
                self.problem_pods
            ));
        }

        if let Some(ns) = &self.current_namespace {
            prompt.push_str(&format!("\n**Active Namespace**: {}\n", ns));
        }

        if !self.recent_issues.is_empty() {
            prompt.push_str("\n## Recent Issues\n");
            for issue in &self.recent_issues {
                prompt.push_str(&format!("- {}\n", issue));
            }
        }

        prompt.push_str(r#"
## Your Capabilities (READ-ONLY Mode)
- View and analyze pod logs
- Query resource status and health
- Analyze deployments, services, and other resources
- Identify issues and problems
- Explain Kubernetes concepts

## Important Restrictions
- You are in READ-ONLY mode
- DO NOT execute any delete, remove, or destructive commands
- DO NOT modify, edit, or update any resources
- If the user asks to delete or modify something, respond with:
  "Löschvorgänge und Änderungen müssen manuell ausgeführt werden. Der AI-Assistent unterstützt derzeit nur das Anzeigen von Logs und Ressourcen. Edit-Modus kommt in einer späteren Version."
- Only use kubectl commands for viewing: get, describe, logs, top

## Guidelines
- Be concise and focus on ANALYSIS only
- Reference resources by namespace/name
- Highlight critical issues first
- NEVER use emojis in your responses
- Use plain text headings like "Critical Issues" instead of emoji symbols

## Important Behavior Rules
- DO NOT give "Recommended Actions" or "Next Steps" unless the user explicitly asks for them
- DO NOT suggest kubectl commands to run manually
- Focus on ANALYZING the current state and explaining what you find
- When you find issues, AUTOMATICALLY fetch and analyze the logs of affected pods
- Summarize what you find in the logs (errors, warnings, patterns)
- When mentioning pods, format them as clickable links: [namespace/pod-name](kubeli://logs/namespace/pod-name)
- Example: "The pod [demo-app/postgres-db-xyz](kubeli://logs/demo-app/postgres-db-xyz) shows OOMKilled errors"
- Your PRIMARY job is to analyze logs and explain issues, not to tell users what commands to run

## Output Format Rules
- DO NOT include thinking, reasoning, or planning text in your response
- DO NOT write things like "Let me check...", "Now I'll...", "First I need to..."
- Give DIRECT answers and analysis results only
- Start immediately with the findings, not with what you're about to do
- Bad: "Let me analyze the deployments. Now let me check the logs..."
- Good: "Deployment Status Analysis:\n\n**Healthy Deployments (15)**\n..."
"#);

        prompt
    }
}

/// Build cluster context from current state
pub struct ContextBuilder;

impl ContextBuilder {
    /// Build context from the current cluster connection
    pub async fn build(
        state: &AppState,
        context_name: &str,
        current_namespace: Option<String>,
    ) -> Result<ClusterContext, String> {
        let client = state
            .k8s
            .get_client()
            .await
            .map_err(|e| format!("Failed to get client: {}", e))?;

        // Get Kubernetes version
        let kubernetes_version = Self::get_kubernetes_version(&client).await;

        // Get nodes and detect platform
        let (node_count, platform) = Self::get_node_info(&client).await;

        // Get namespace count
        let namespace_count = Self::get_namespace_count(&client).await;

        // Get pod status
        let (running_pods, problem_pods, recent_issues) =
            Self::get_pod_status(&client, &current_namespace).await;

        Ok(ClusterContext {
            context_name: context_name.to_string(),
            kubernetes_version,
            platform,
            node_count,
            namespace_count,
            running_pods,
            problem_pods,
            current_namespace,
            recent_issues,
        })
    }

    /// Get Kubernetes server version
    async fn get_kubernetes_version(client: &kube::Client) -> Option<String> {
        match client.apiserver_version().await {
            Ok(info) => Some(format!("{}.{}", info.major, info.minor)),
            Err(_) => None,
        }
    }

    /// Get node count and detect platform
    async fn get_node_info(client: &kube::Client) -> (usize, Option<String>) {
        let nodes: Api<Node> = Api::all(client.clone());
        match nodes.list(&ListParams::default().limit(100)).await {
            Ok(node_list) => {
                let count = node_list.items.len();
                let platform = node_list.items.first().and_then(|node| {
                    let labels = node.metadata.labels.as_ref()?;

                    // Detect platform from labels
                    if labels.contains_key("eks.amazonaws.com/nodegroup") {
                        Some("Amazon EKS".to_string())
                    } else if labels.contains_key("cloud.google.com/gke-nodepool") {
                        Some("Google GKE".to_string())
                    } else if labels.contains_key("kubernetes.azure.com/cluster") {
                        Some("Azure AKS".to_string())
                    } else if labels.get("minikube.k8s.io/name").is_some() {
                        Some("Minikube".to_string())
                    } else if labels
                        .get("node.kubernetes.io/instance-type")
                        .is_some_and(|v| v.contains("kind"))
                    {
                        Some("Kind".to_string())
                    } else if labels.get("k3s.io/hostname").is_some() {
                        Some("K3s".to_string())
                    } else {
                        None
                    }
                });
                (count, platform)
            }
            Err(_) => (0, None),
        }
    }

    /// Get namespace count
    async fn get_namespace_count(client: &kube::Client) -> usize {
        let namespaces: Api<Namespace> = Api::all(client.clone());
        match namespaces.list(&ListParams::default().limit(100)).await {
            Ok(ns_list) => ns_list.items.len(),
            Err(_) => 0,
        }
    }

    /// Get pod status and issues
    async fn get_pod_status(
        client: &kube::Client,
        namespace: &Option<String>,
    ) -> (usize, usize, Vec<String>) {
        let pods: Api<Pod> = if let Some(ns) = namespace {
            Api::namespaced(client.clone(), ns)
        } else {
            Api::all(client.clone())
        };

        match pods.list(&ListParams::default().limit(500)).await {
            Ok(pod_list) => {
                let mut running = 0;
                let mut problems = 0;
                let mut issues = Vec::new();

                for pod in &pod_list.items {
                    let name = pod.metadata.name.as_deref().unwrap_or("unknown");
                    let ns = pod.metadata.namespace.as_deref().unwrap_or("default");

                    if let Some(status) = &pod.status {
                        let phase = status.phase.as_deref().unwrap_or("Unknown");

                        match phase {
                            "Running" | "Succeeded" => running += 1,
                            "Failed" => {
                                problems += 1;
                                if issues.len() < 5 {
                                    issues.push(format!("Pod {}/{} is in Failed state", ns, name));
                                }
                            }
                            "Pending" => {
                                problems += 1;
                                // Check for scheduling issues
                                if let Some(conditions) = &status.conditions {
                                    for condition in conditions {
                                        if condition.type_ == "PodScheduled"
                                            && condition.status == "False"
                                            && issues.len() < 5
                                        {
                                            let reason = condition
                                                .reason
                                                .as_deref()
                                                .unwrap_or("Unknown");
                                            issues.push(format!(
                                                "Pod {}/{} pending: {}",
                                                ns, name, reason
                                            ));
                                        }
                                    }
                                }
                            }
                            _ => {
                                problems += 1;
                            }
                        }

                        // Check for container issues
                        if let Some(container_statuses) = &status.container_statuses {
                            for cs in container_statuses {
                                if cs.restart_count > 5 && issues.len() < 5 {
                                    issues.push(format!(
                                        "Container {} in {}/{} has {} restarts",
                                        cs.name, ns, name, cs.restart_count
                                    ));
                                }
                            }
                        }
                    }
                }

                (running, problems, issues)
            }
            Err(_) => (0, 0, Vec::new()),
        }
    }
}
