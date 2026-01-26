use crate::k8s::AppState;
use futures::AsyncBufReadExt as FuturesAsyncBufReadExt;
use k8s_openapi::api::core::v1::Pod;
use kube::api::{Api, LogParams};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};
use tokio::sync::RwLock;

/// Log stream entry with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: Option<String>,
    pub message: String,
    pub container: String,
    pub pod: String,
    pub namespace: String,
}

/// Log stream event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum LogEvent {
    Line(LogEntry),
    Error(String),
    Started { stream_id: String },
    Stopped { stream_id: String },
}

/// Options for streaming logs
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LogOptions {
    pub namespace: String,
    pub pod_name: String,
    pub container: Option<String>,
    pub follow: Option<bool>,
    pub tail_lines: Option<i64>,
    pub since_seconds: Option<i64>,
    pub timestamps: Option<bool>,
    pub previous: Option<bool>,
}

/// Active log stream session
struct LogStreamSession {
    stop_flag: Arc<AtomicBool>,
}

/// Manager for active log streams
pub struct LogStreamManager {
    active_streams: RwLock<HashMap<String, LogStreamSession>>,
}

impl LogStreamManager {
    pub fn new() -> Self {
        Self {
            active_streams: RwLock::new(HashMap::new()),
        }
    }

    pub async fn add_stream(&self, id: String, stop_flag: Arc<AtomicBool>) {
        let mut streams = self.active_streams.write().await;
        streams.insert(id, LogStreamSession { stop_flag });
    }

    pub async fn stop_stream(&self, id: &str) -> bool {
        let streams = self.active_streams.read().await;
        if let Some(session) = streams.get(id) {
            session.stop_flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub async fn remove_stream(&self, id: &str) {
        let mut streams = self.active_streams.write().await;
        streams.remove(id);
    }

    pub async fn is_active(&self, id: &str) -> bool {
        let streams = self.active_streams.read().await;
        streams.contains_key(id)
    }
}

impl Default for LogStreamManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Get logs from a pod (non-streaming, returns all at once)
#[command]
pub async fn get_pod_logs(
    state: State<'_, AppState>,
    options: LogOptions,
) -> Result<Vec<LogEntry>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let pods: Api<Pod> = Api::namespaced(client, &options.namespace);

    let mut log_params = LogParams {
        follow: false,
        timestamps: options.timestamps.unwrap_or(true),
        tail_lines: options.tail_lines,
        since_seconds: options.since_seconds,
        previous: options.previous.unwrap_or(false),
        ..Default::default()
    };

    if let Some(container) = &options.container {
        log_params.container = Some(container.clone());
    }

    let logs = pods
        .logs(&options.pod_name, &log_params)
        .await
        .map_err(|e| format!("Failed to get logs: {}", e))?;

    let container_name = options
        .container
        .clone()
        .unwrap_or_else(|| "default".to_string());
    let entries: Vec<LogEntry> = logs
        .lines()
        .map(|line| parse_log_line(line, &container_name, &options.pod_name, &options.namespace))
        .collect();

    tracing::info!(
        "Retrieved {} log lines from {}/{}",
        entries.len(),
        options.namespace,
        options.pod_name
    );

    Ok(entries)
}

/// Stream logs from a pod in real-time
#[command]
pub async fn stream_pod_logs(
    app: AppHandle,
    state: State<'_, AppState>,
    log_manager: State<'_, Arc<LogStreamManager>>,
    stream_id: String,
    options: LogOptions,
) -> Result<(), String> {
    tracing::info!(
        "Starting log stream {} for {}/{} container={:?}",
        stream_id,
        options.namespace,
        options.pod_name,
        options.container
    );

    // Check if stream already exists
    if log_manager.is_active(&stream_id).await {
        return Err(format!("Stream {} already exists", stream_id));
    }

    let client = state.k8s.get_client().await.map_err(|e| {
        tracing::error!("Failed to get k8s client: {}", e);
        e.to_string()
    })?;

    let pods: Api<Pod> = Api::namespaced(client, &options.namespace);

    let mut log_params = LogParams {
        follow: options.follow.unwrap_or(true),
        timestamps: options.timestamps.unwrap_or(true),
        tail_lines: options.tail_lines.or(Some(100)),
        since_seconds: options.since_seconds,
        previous: options.previous.unwrap_or(false),
        ..Default::default()
    };

    if let Some(container) = &options.container {
        log_params.container = Some(container.clone());
    }

    // Create stop flag
    let stop_flag = Arc::new(AtomicBool::new(false));
    log_manager
        .add_stream(stream_id.clone(), stop_flag.clone())
        .await;

    let event_name = format!("log-stream-{}", stream_id);
    let container_name = options
        .container
        .clone()
        .unwrap_or_else(|| "default".to_string());
    let pod_name = options.pod_name.clone();
    let namespace = options.namespace.clone();

    // Emit started event
    let _ = app.emit(
        &event_name,
        LogEvent::Started {
            stream_id: stream_id.clone(),
        },
    );

    // Spawn the log streaming task
    let stream_id_clone = stream_id.clone();
    let log_manager_clone = Arc::clone(&log_manager);

    tokio::spawn(async move {
        tracing::info!("Log stream task started for {}/{}", namespace, pod_name);
        match pods.log_stream(&pod_name, &log_params).await {
            Ok(stream) => {
                tracing::info!("Log stream connected for {}/{}", namespace, pod_name);
                // Use futures::io::AsyncBufReadExt::lines() which returns a Stream
                use futures::StreamExt;
                let mut lines_stream = stream.lines();

                while let Some(result) = lines_stream.next().await {
                    // Check stop flag
                    if stop_flag.load(Ordering::SeqCst) {
                        tracing::info!("Log stream {} stopped by user", stream_id_clone);
                        break;
                    }

                    match result {
                        Ok(line) => {
                            let entry =
                                parse_log_line(&line, &container_name, &pod_name, &namespace);
                            let _ = app.emit(&event_name, LogEvent::Line(entry));
                        }
                        Err(e) => {
                            tracing::error!("Log stream read error: {}", e);
                            let _ = app
                                .emit(&event_name, LogEvent::Error(format!("Stream error: {}", e)));
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                let error_detail = format!(
                    "Failed to start log stream for {}/{} (container: {:?}): {}",
                    namespace, pod_name, container_name, e
                );
                tracing::error!("{}", error_detail);
                let _ = app.emit(&event_name, LogEvent::Error(error_detail));
            }
        }

        // Clean up
        log_manager_clone.remove_stream(&stream_id_clone).await;
        let _ = app.emit(
            &event_name,
            LogEvent::Stopped {
                stream_id: stream_id_clone,
            },
        );
    });

    Ok(())
}

/// Stop a log stream
#[command]
pub async fn stop_log_stream(
    log_manager: State<'_, Arc<LogStreamManager>>,
    stream_id: String,
) -> Result<(), String> {
    if log_manager.stop_stream(&stream_id).await {
        log_manager.remove_stream(&stream_id).await;
        tracing::info!("Stopped log stream {}", stream_id);
        Ok(())
    } else {
        Err(format!("Stream {} not found", stream_id))
    }
}

/// Get container names from a pod
#[command]
pub async fn get_pod_containers(
    state: State<'_, AppState>,
    namespace: String,
    pod_name: String,
) -> Result<Vec<String>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let pods: Api<Pod> = Api::namespaced(client, &namespace);
    let pod = pods
        .get(&pod_name)
        .await
        .map_err(|e| format!("Failed to get pod: {}", e))?;

    let spec = pod.spec.ok_or("Pod has no spec")?;
    let containers: Vec<String> = spec.containers.iter().map(|c| c.name.clone()).collect();

    // Also include init containers if any
    let mut all_containers = containers;
    if let Some(init_containers) = spec.init_containers {
        for ic in init_containers {
            all_containers.push(format!("init:{}", ic.name));
        }
    }

    Ok(all_containers)
}

/// Download logs from a pod
#[command]
pub async fn download_pod_logs(
    state: State<'_, AppState>,
    options: LogOptions,
) -> Result<String, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let pods: Api<Pod> = Api::namespaced(client, &options.namespace);

    let mut log_params = LogParams {
        follow: false,
        timestamps: options.timestamps.unwrap_or(true),
        tail_lines: None, // Get all logs for download
        since_seconds: options.since_seconds,
        previous: options.previous.unwrap_or(false),
        ..Default::default()
    };

    if let Some(container) = &options.container {
        log_params.container = Some(container.clone());
    }

    let logs = pods
        .logs(&options.pod_name, &log_params)
        .await
        .map_err(|e| format!("Failed to get logs: {}", e))?;

    tracing::info!(
        "Downloaded logs from {}/{} ({} bytes)",
        options.namespace,
        options.pod_name,
        logs.len()
    );

    Ok(logs)
}

/// Parse a log line into a LogEntry
fn parse_log_line(line: &str, container: &str, pod: &str, namespace: &str) -> LogEntry {
    // Try to parse timestamp from beginning of line (RFC3339 format)
    // Format: 2024-01-01T12:00:00.000000000Z message
    let (timestamp, message) = if line.len() > 30 && line.chars().nth(4) == Some('-') {
        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        if parts.len() == 2 {
            (Some(parts[0].to_string()), parts[1].to_string())
        } else {
            (None, line.to_string())
        }
    } else {
        (None, line.to_string())
    };

    LogEntry {
        timestamp,
        message,
        container: container.to_string(),
        pod: pod.to_string(),
        namespace: namespace.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_timestamped_log_line() {
        let entry = parse_log_line(
            "2024-01-01T12:00:00.000000000Z hello world",
            "app",
            "demo-pod",
            "default",
        );

        assert_eq!(
            entry.timestamp.as_deref(),
            Some("2024-01-01T12:00:00.000000000Z")
        );
        assert_eq!(entry.message, "hello world");
        assert_eq!(entry.container, "app");
        assert_eq!(entry.pod, "demo-pod");
        assert_eq!(entry.namespace, "default");
    }

    #[test]
    fn parses_plain_log_line() {
        let entry = parse_log_line("plain log", "app", "demo-pod", "default");

        assert!(entry.timestamp.is_none());
        assert_eq!(entry.message, "plain log");
    }

    #[test]
    fn parses_log_line_with_spaces_in_message() {
        let entry = parse_log_line(
            "2024-06-15T08:30:45.123456789Z INFO Starting server on port 8080",
            "nginx",
            "web-pod",
            "production",
        );

        assert_eq!(
            entry.timestamp.as_deref(),
            Some("2024-06-15T08:30:45.123456789Z")
        );
        assert_eq!(entry.message, "INFO Starting server on port 8080");
    }

    #[test]
    fn parses_empty_log_line() {
        let entry = parse_log_line("", "app", "demo-pod", "default");

        assert!(entry.timestamp.is_none());
        assert_eq!(entry.message, "");
    }

    #[test]
    fn parses_short_log_line() {
        let entry = parse_log_line("abc", "app", "demo-pod", "default");

        assert!(entry.timestamp.is_none());
        assert_eq!(entry.message, "abc");
    }

    #[test]
    fn log_entry_serialization() {
        let entry = LogEntry {
            timestamp: Some("2024-01-01T00:00:00Z".to_string()),
            message: "Test message".to_string(),
            container: "app".to_string(),
            pod: "test-pod".to_string(),
            namespace: "default".to_string(),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"message\":\"Test message\""));
        assert!(json.contains("\"container\":\"app\""));
    }

    #[test]
    fn log_options_default() {
        let options = LogOptions::default();

        assert!(options.namespace.is_empty());
        assert!(options.pod_name.is_empty());
        assert!(options.container.is_none());
        assert!(options.follow.is_none());
        assert!(options.tail_lines.is_none());
    }

    #[test]
    fn log_event_line_serialization() {
        let entry = LogEntry {
            timestamp: None,
            message: "test".to_string(),
            container: "app".to_string(),
            pod: "pod".to_string(),
            namespace: "ns".to_string(),
        };
        let event = LogEvent::Line(entry);

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"Line\""));
    }

    #[test]
    fn log_event_error_serialization() {
        let event = LogEvent::Error("Connection failed".to_string());

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"Error\""));
        assert!(json.contains("Connection failed"));
    }

    #[test]
    fn log_event_started_serialization() {
        let event = LogEvent::Started {
            stream_id: "stream-123".to_string(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"Started\""));
        assert!(json.contains("stream-123"));
    }

    #[test]
    fn log_event_stopped_serialization() {
        let event = LogEvent::Stopped {
            stream_id: "stream-456".to_string(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"Stopped\""));
        assert!(json.contains("stream-456"));
    }

    #[tokio::test]
    async fn log_stream_manager_new() {
        let manager = LogStreamManager::new();

        // Should start with no active streams
        assert!(!manager.is_active("non-existent").await);
    }

    #[tokio::test]
    async fn log_stream_manager_add_and_check() {
        let manager = LogStreamManager::new();
        let stop_flag = Arc::new(AtomicBool::new(false));

        manager.add_stream("stream-1".to_string(), stop_flag).await;

        assert!(manager.is_active("stream-1").await);
        assert!(!manager.is_active("stream-2").await);
    }

    #[tokio::test]
    async fn log_stream_manager_stop_stream() {
        let manager = LogStreamManager::new();
        let stop_flag = Arc::new(AtomicBool::new(false));

        manager
            .add_stream("stream-1".to_string(), stop_flag.clone())
            .await;

        // Stop flag should be false initially
        assert!(!stop_flag.load(Ordering::SeqCst));

        // Stop the stream
        let result = manager.stop_stream("stream-1").await;
        assert!(result);

        // Stop flag should now be true
        assert!(stop_flag.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn log_stream_manager_stop_non_existent() {
        let manager = LogStreamManager::new();

        let result = manager.stop_stream("non-existent").await;
        assert!(!result);
    }

    #[tokio::test]
    async fn log_stream_manager_remove_stream() {
        let manager = LogStreamManager::new();
        let stop_flag = Arc::new(AtomicBool::new(false));

        manager.add_stream("stream-1".to_string(), stop_flag).await;
        assert!(manager.is_active("stream-1").await);

        manager.remove_stream("stream-1").await;
        assert!(!manager.is_active("stream-1").await);
    }

    #[test]
    fn log_stream_manager_default() {
        let manager = LogStreamManager::default();
        // Just verify it doesn't panic and creates properly
        assert!(std::mem::size_of_val(&manager) > 0);
    }
}
