// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod commands;
mod k8s;
mod mcp;
mod network;

use ai::agent_manager::AgentManager;
use ai::commands::AIConfigState;
use ai::session_store::create_session_store;
use clap::Parser;
use commands::logs::LogStreamManager;
use commands::portforward::PortForwardManager;
use commands::shell::ShellSessionManager;
use commands::watch::WatchManager;
use k8s::AppState;
use std::env;
use std::sync::Arc;

/// Kubeli - Modern Kubernetes Management Desktop Application
#[derive(Parser, Debug)]
#[command(name = "kubeli")]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Run as MCP (Model Context Protocol) server for IDE integration
    #[arg(long)]
    mcp: bool,
}
#[cfg(target_os = "macos")]
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};
#[allow(unused_imports)]
use tauri::{Emitter, Manager};

fn extend_path_with_common_cli_dirs() {
    use std::path::PathBuf;

    let mut paths: Vec<PathBuf> =
        env::split_paths(&env::var_os("PATH").unwrap_or_default()).collect();

    #[cfg(target_os = "macos")]
    const EXTRA_PATHS: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin"];
    #[cfg(target_os = "linux")]
    const EXTRA_PATHS: &[&str] = &["/usr/local/bin"];
    #[cfg(target_os = "windows")]
    const EXTRA_PATHS: &[&str] = &[];

    let mut updated = false;
    for dir in EXTRA_PATHS {
        let candidate = PathBuf::from(dir);
        if candidate.exists() && !paths.iter().any(|p| p == &candidate) {
            paths.push(candidate);
            updated = true;
        }
    }

    if updated {
        if let Ok(joined) = env::join_paths(paths.clone()) {
            env::set_var("PATH", &joined);
            tracing::info!("Extended PATH with common CLI directories to support exec auth");
        }
    }
}

fn main() {
    extend_path_with_common_cli_dirs();

    // Parse command line arguments
    let args = Args::parse();

    // If --mcp flag is passed, run MCP server instead of GUI
    if args.mcp {
        // Install the ring crypto provider for rustls
        rustls::crypto::ring::default_provider()
            .install_default()
            .expect("Failed to install rustls crypto provider");

        // Run MCP server
        let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
        rt.block_on(async {
            if let Err(e) = mcp::run_mcp_server().await {
                eprintln!("MCP server error: {}", e);
                std::process::exit(1);
            }
        });
        return;
    }

    // Install the ring crypto provider for rustls before anything else
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    // Deep-link plugin only in debug builds (screenshot automation)
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_deep_link::init());
    }

    builder
        .manage(AppState::new())
        .manage(Arc::new(WatchManager::new()))
        .manage(Arc::new(LogStreamManager::new()))
        .manage(Arc::new(ShellSessionManager::new()))
        .manage(Arc::new(PortForwardManager::new()))
        .manage(AIConfigState::new())
        .manage(Arc::new(AgentManager::new()))
        .setup(|app| {
            // Initialize AI session store
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            let db_path = app_data_dir.join("ai_sessions.db");
            let session_store = create_session_store(db_path)
                .expect("Failed to create session store");
            app.manage(session_store);

            // Build macOS app menu
            #[cfg(target_os = "macos")]
            {
                use chrono::{Datelike, Utc};
                let about_metadata = AboutMetadataBuilder::new()
                    .name(Some("Kubeli"))
                    .version(Some("0.1.0"))
                    .copyright(Some(&format!("© {} Kubeli", Utc::now().year())))
                    .comments(Some("Modern Kubernetes Management Desktop Application.\n\nThank you for using Kubeli!"))
                    .build();

                let app_submenu = SubmenuBuilder::new(app, "Kubeli")
                    .about(Some(about_metadata))
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;

                let edit_submenu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                let window_submenu = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .separator()
                    .close_window()
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .item(&app_submenu)
                    .item(&edit_submenu)
                    .item(&window_submenu)
                    .build()?;

                app.set_menu(menu)?;
            }

            // Deep links for screenshot automation (debug builds only)
            #[cfg(all(desktop, debug_assertions))]
            {
                use percent_encoding::percent_decode_str;
                use tauri_plugin_deep_link::DeepLinkExt;
                let app_handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    if let Some(url) = urls.first() {
                        let host = url.host_str().unwrap_or_default();
                        let path = percent_decode_str(url.path().trim_start_matches('/'))
                            .decode_utf8_lossy()
                            .to_string();
                        match host {
                            // kubeli://view/<resource-type>
                            "view" if !path.is_empty() => {
                                let _ = app_handle.emit("navigate", serde_json::json!({ "view": path }));
                            }
                            // kubeli://connect/<context-name>
                            "connect" if !path.is_empty() => {
                                let _ = app_handle.emit("auto-connect", serde_json::json!({ "context": path }));
                            }
                            _ => {}
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Cluster commands
            commands::clusters::list_clusters,
            commands::clusters::add_cluster,
            commands::clusters::remove_cluster,
            commands::clusters::switch_context,
            commands::clusters::get_namespaces,
            commands::clusters::connect_cluster,
            commands::clusters::disconnect_cluster,
            commands::clusters::get_connection_status,
            commands::clusters::check_connection_health,
            commands::clusters::has_kubeconfig,
            // Kubeconfig source commands
            commands::kubeconfig::get_kubeconfig_sources,
            commands::kubeconfig::set_kubeconfig_sources,
            commands::kubeconfig::add_kubeconfig_source,
            commands::kubeconfig::remove_kubeconfig_source,
            commands::kubeconfig::list_kubeconfig_sources,
            commands::kubeconfig::validate_kubeconfig_path,
            commands::kubeconfig::set_kubeconfig_merge_mode,
            // Debug commands
            commands::debug::export_debug_info,
            commands::debug::generate_debug_log,
            // Resource commands
            commands::resources::list_pods,
            commands::resources::list_deployments,
            commands::resources::list_services,
            commands::resources::list_configmaps,
            commands::resources::list_secrets,
            commands::resources::list_nodes,
            commands::resources::list_namespaces,
            commands::resources::list_events,
            commands::resources::list_leases,
            commands::resources::list_replicasets,
            commands::resources::list_daemonsets,
            commands::resources::list_statefulsets,
            commands::resources::list_jobs,
            commands::resources::list_cronjobs,
            // Networking resources
            commands::resources::list_ingresses,
            commands::resources::list_endpoint_slices,
            commands::resources::list_network_policies,
            commands::resources::list_ingress_classes,
            // Configuration resources
            commands::resources::list_hpas,
            commands::resources::list_limit_ranges,
            commands::resources::list_resource_quotas,
            commands::resources::list_pdbs,
            // Storage resources
            commands::resources::list_persistent_volumes,
            commands::resources::list_persistent_volume_claims,
            commands::resources::list_storage_classes,
            commands::resources::list_csi_drivers,
            commands::resources::list_csi_nodes,
            commands::resources::list_volume_attachments,
            // Access Control resources
            commands::resources::list_service_accounts,
            commands::resources::list_roles,
            commands::resources::list_role_bindings,
            commands::resources::list_cluster_roles,
            commands::resources::list_cluster_role_bindings,
            // Administration resources
            commands::resources::list_crds,
            commands::resources::list_priority_classes,
            commands::resources::list_runtime_classes,
            commands::resources::list_mutating_webhooks,
            commands::resources::list_validating_webhooks,
            commands::resources::get_pod,
            commands::resources::delete_pod,
            commands::resources::get_resource_yaml,
            commands::resources::apply_resource_yaml,
            commands::resources::delete_resource,
            commands::resources::scale_deployment,
            // Watch commands
            commands::watch::watch_pods,
            commands::watch::watch_namespaces,
            commands::watch::stop_watch,
            // Log commands
            commands::logs::get_pod_logs,
            commands::logs::stream_pod_logs,
            commands::logs::stop_log_stream,
            commands::logs::get_pod_containers,
            commands::logs::download_pod_logs,
            // Shell commands
            commands::shell::shell_start,
            commands::shell::shell_send_input,
            commands::shell::shell_resize,
            commands::shell::shell_close,
            commands::shell::shell_list_sessions,
            // Port forward commands
            commands::portforward::portforward_start,
            commands::portforward::portforward_stop,
            commands::portforward::portforward_list,
            commands::portforward::portforward_get,
            commands::portforward::portforward_check_port,
            // Metrics commands
            commands::metrics::get_node_metrics,
            commands::metrics::get_pod_metrics,
            commands::metrics::get_cluster_metrics_summary,
            commands::metrics::check_metrics_server,
            // Graph commands
            commands::graph::generate_resource_graph,
            // Helm commands
            commands::helm::list_helm_releases,
            commands::helm::get_helm_release,
            commands::helm::get_helm_release_history,
            commands::helm::get_helm_release_values,
            commands::helm::get_helm_release_manifest,
            commands::helm::uninstall_helm_release,
            // Flux commands
            commands::flux::list_flux_kustomizations,
            commands::flux::reconcile_flux_kustomization,
            commands::flux::suspend_flux_kustomization,
            commands::flux::resume_flux_kustomization,
            commands::flux::reconcile_flux_helmrelease,
            commands::flux::suspend_flux_helmrelease,
            commands::flux::resume_flux_helmrelease,
            // Network commands
            commands::network::set_proxy_config,
            commands::network::get_proxy_config,
            // MCP commands
            commands::mcp::mcp_detect_ides,
            commands::mcp::mcp_install_ide,
            commands::mcp::mcp_uninstall_ide,
            commands::mcp::mcp_get_kubeli_path,
            // AI commands (Claude)
            ai::commands::ai_check_cli_available,
            ai::commands::ai_verify_authentication,
            ai::commands::ai_set_api_key,
            ai::commands::ai_get_auth_status,
            // AI commands (Codex)
            ai::commands::ai_check_codex_cli_available,
            ai::commands::ai_verify_codex_authentication,
            ai::commands::ai_get_codex_auth_status,
            // AI session commands
            ai::commands::ai_start_session,
            ai::commands::ai_send_message,
            ai::commands::ai_interrupt,
            ai::commands::ai_stop_session,
            ai::commands::ai_list_sessions,
            ai::commands::ai_is_session_active,
            // AI context commands
            ai::commands::ai_build_context,
            ai::commands::ai_get_system_prompt,
            // AI permission commands
            ai::commands::ai_get_permission_mode,
            ai::commands::ai_set_permission_mode,
            ai::commands::ai_get_permission_status,
            ai::commands::ai_add_sandboxed_namespace,
            ai::commands::ai_remove_sandboxed_namespace,
            ai::commands::ai_get_sandboxed_namespaces,
            ai::commands::ai_list_pending_approvals,
            ai::commands::ai_approve_action,
            ai::commands::ai_reject_action,
            // AI session persistence commands
            ai::commands::ai_list_saved_sessions,
            ai::commands::ai_get_conversation_history,
            ai::commands::ai_save_session,
            ai::commands::ai_save_message,
            ai::commands::ai_update_message,
            ai::commands::ai_update_session_title,
            ai::commands::ai_delete_saved_session,
            ai::commands::ai_delete_cluster_sessions,
            ai::commands::ai_get_resume_context,
            ai::commands::ai_cleanup_old_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
