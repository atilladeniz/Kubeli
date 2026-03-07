use crate::ai::agent_manager::AgentManager;
use crate::ai::commands::AIConfigState;
use crate::ai::session_store::create_session_store;
use crate::app::tray;
use crate::commands::logs::LogStreamManager;
use crate::commands::portforward::{PortForwardManager, PortForwardWatchManager};
use crate::commands::shell::ShellSessionManager;
use crate::commands::watch::WatchManager;
use crate::k8s::AppState;
use std::sync::Arc;
use tauri::{Emitter, Manager};

pub fn run() {
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
        .manage(Arc::new(PortForwardWatchManager::new()))
        .manage(AIConfigState::new())
        .manage(Arc::new(AgentManager::new()))
        .setup(setup_app)
        .on_menu_event(|app, event| tray::handle_menu_event(app, event))
        .invoke_handler(tauri::generate_handler![
            crate::app::tray::show_main_window_command,
            crate::app::tray::quit_app,
            crate::commands::clusters::list_clusters,
            crate::commands::clusters::add_cluster,
            crate::commands::clusters::remove_cluster,
            crate::commands::clusters::switch_context,
            crate::commands::clusters::get_namespaces,
            crate::commands::clusters::connect_cluster,
            crate::commands::clusters::disconnect_cluster,
            crate::commands::clusters::get_connection_status,
            crate::commands::clusters::check_connection_health,
            crate::commands::clusters::has_kubeconfig,
            crate::commands::cluster_settings::get_cluster_settings,
            crate::commands::cluster_settings::set_cluster_accessible_namespaces,
            crate::commands::cluster_settings::clear_cluster_settings,
            crate::commands::kubeconfig::get_kubeconfig_sources,
            crate::commands::kubeconfig::set_kubeconfig_sources,
            crate::commands::kubeconfig::add_kubeconfig_source,
            crate::commands::kubeconfig::remove_kubeconfig_source,
            crate::commands::kubeconfig::list_kubeconfig_sources,
            crate::commands::kubeconfig::validate_kubeconfig_path,
            crate::commands::kubeconfig::set_kubeconfig_merge_mode,
            crate::commands::debug::export_debug_info,
            crate::commands::debug::generate_debug_log,
            crate::commands::resources::list_pods,
            crate::commands::resources::list_deployments,
            crate::commands::resources::list_services,
            crate::commands::resources::list_configmaps,
            crate::commands::resources::list_secrets,
            crate::commands::resources::list_nodes,
            crate::commands::resources::list_namespaces,
            crate::commands::resources::list_events,
            crate::commands::resources::list_leases,
            crate::commands::resources::list_replicasets,
            crate::commands::resources::list_daemonsets,
            crate::commands::resources::list_statefulsets,
            crate::commands::resources::list_jobs,
            crate::commands::resources::list_cronjobs,
            crate::commands::resources::list_ingresses,
            crate::commands::resources::list_endpoint_slices,
            crate::commands::resources::list_network_policies,
            crate::commands::resources::list_ingress_classes,
            crate::commands::resources::list_hpas,
            crate::commands::resources::list_limit_ranges,
            crate::commands::resources::list_resource_quotas,
            crate::commands::resources::list_pdbs,
            crate::commands::resources::list_persistent_volumes,
            crate::commands::resources::list_persistent_volume_claims,
            crate::commands::resources::list_storage_classes,
            crate::commands::resources::list_csi_drivers,
            crate::commands::resources::list_csi_nodes,
            crate::commands::resources::list_volume_attachments,
            crate::commands::resources::list_service_accounts,
            crate::commands::resources::list_roles,
            crate::commands::resources::list_role_bindings,
            crate::commands::resources::list_cluster_roles,
            crate::commands::resources::list_cluster_role_bindings,
            crate::commands::resources::list_crds,
            crate::commands::resources::list_priority_classes,
            crate::commands::resources::list_runtime_classes,
            crate::commands::resources::list_mutating_webhooks,
            crate::commands::resources::list_validating_webhooks,
            crate::commands::resources::get_pod,
            crate::commands::resources::delete_pod,
            crate::commands::resources::get_resource_yaml,
            crate::commands::resources::apply_resource_yaml,
            crate::commands::resources::delete_resource,
            crate::commands::resources::scale_deployment,
            crate::commands::watch::watch_pods,
            crate::commands::watch::watch_namespaces,
            crate::commands::watch::stop_watch,
            crate::commands::logs::get_pod_logs,
            crate::commands::logs::stream_pod_logs,
            crate::commands::logs::stop_log_stream,
            crate::commands::logs::get_pod_containers,
            crate::commands::logs::download_pod_logs,
            crate::commands::shell::shell_start,
            crate::commands::shell::shell_send_input,
            crate::commands::shell::shell_resize,
            crate::commands::shell::shell_close,
            crate::commands::shell::shell_list_sessions,
            crate::commands::portforward::portforward_start,
            crate::commands::portforward::portforward_stop,
            crate::commands::portforward::portforward_list,
            crate::commands::portforward::portforward_get,
            crate::commands::portforward::portforward_check_port,
            crate::commands::metrics::get_node_metrics,
            crate::commands::metrics::get_pod_metrics,
            crate::commands::metrics::get_pod_metrics_direct,
            crate::commands::metrics::get_cluster_metrics_summary,
            crate::commands::metrics::check_metrics_server,
            crate::commands::graph::generate_resource_graph,
            crate::commands::helm::list_helm_releases,
            crate::commands::helm::get_helm_release,
            crate::commands::helm::get_helm_release_history,
            crate::commands::helm::get_helm_release_values,
            crate::commands::helm::get_helm_release_manifest,
            crate::commands::helm::uninstall_helm_release,
            crate::commands::flux::list_flux_kustomizations,
            crate::commands::flux::reconcile_flux_kustomization,
            crate::commands::flux::suspend_flux_kustomization,
            crate::commands::flux::resume_flux_kustomization,
            crate::commands::flux::reconcile_flux_helmrelease,
            crate::commands::flux::suspend_flux_helmrelease,
            crate::commands::flux::resume_flux_helmrelease,
            crate::commands::network::set_proxy_config,
            crate::commands::network::get_proxy_config,
            crate::commands::mcp::mcp_detect_ides,
            crate::commands::mcp::mcp_install_ide,
            crate::commands::mcp::mcp_uninstall_ide,
            crate::commands::mcp::mcp_get_kubeli_path,
            crate::ai::commands::ai_check_cli_available,
            crate::ai::commands::ai_verify_authentication,
            crate::ai::commands::ai_set_api_key,
            crate::ai::commands::ai_get_auth_status,
            crate::ai::commands::ai_check_codex_cli_available,
            crate::ai::commands::ai_verify_codex_authentication,
            crate::ai::commands::ai_get_codex_auth_status,
            crate::ai::commands::ai_start_session,
            crate::ai::commands::ai_send_message,
            crate::ai::commands::ai_interrupt,
            crate::ai::commands::ai_stop_session,
            crate::ai::commands::ai_list_sessions,
            crate::ai::commands::ai_is_session_active,
            crate::ai::commands::ai_build_context,
            crate::ai::commands::ai_get_system_prompt,
            crate::ai::commands::ai_get_permission_mode,
            crate::ai::commands::ai_set_permission_mode,
            crate::ai::commands::ai_get_permission_status,
            crate::ai::commands::ai_add_sandboxed_namespace,
            crate::ai::commands::ai_remove_sandboxed_namespace,
            crate::ai::commands::ai_get_sandboxed_namespaces,
            crate::ai::commands::ai_list_pending_approvals,
            crate::ai::commands::ai_approve_action,
            crate::ai::commands::ai_reject_action,
            crate::ai::commands::ai_list_saved_sessions,
            crate::ai::commands::ai_get_conversation_history,
            crate::ai::commands::ai_save_session,
            crate::ai::commands::ai_save_message,
            crate::ai::commands::ai_update_message,
            crate::ai::commands::ai_update_session_title,
            crate::ai::commands::ai_delete_saved_session,
            crate::ai::commands::ai_delete_cluster_sessions,
            crate::ai::commands::ai_get_resume_context,
            crate::ai::commands::ai_cleanup_old_sessions,
        ])
        .on_window_event(|window, event| tray::handle_window_event(window, event))
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| tray::handle_run_event(app_handle, event));
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    initialize_ai_session_store(app);

    #[cfg(target_os = "macos")]
    if let Err(error) = tray::setup(app) {
        tracing::error!("Failed to setup tray icon: {}", error);
    }

    #[cfg(target_os = "macos")]
    setup_macos_menu(app)?;

    #[cfg(all(desktop, debug_assertions))]
    setup_deep_links(app);

    Ok(())
}

fn initialize_ai_session_store(app: &mut tauri::App) {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    let db_path = app_data_dir.join("ai_sessions.db");
    let session_store = create_session_store(db_path).expect("Failed to create session store");
    app.manage(session_store);
}

#[cfg(target_os = "macos")]
fn setup_macos_menu(app: &mut tauri::App) -> tauri::Result<()> {
    use chrono::{Datelike, Utc};
    use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};

    let about_metadata = AboutMetadataBuilder::new()
        .name(Some("Kubeli"))
        .version(Some("0.1.0"))
        .copyright(Some(&format!("© {} Kubeli", Utc::now().year())))
        .comments(Some(
            "Modern Kubernetes Management Desktop Application.\n\nThank you for using Kubeli!",
        ))
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
    Ok(())
}

#[cfg(all(desktop, debug_assertions))]
fn setup_deep_links(app: &mut tauri::App) {
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
                "view" if !path.is_empty() => {
                    let _ = app_handle.emit("navigate", serde_json::json!({ "view": path }));
                }
                "connect" if !path.is_empty() => {
                    let _ = app_handle.emit("auto-connect", serde_json::json!({ "context": path }));
                }
                _ => {}
            }
        }
    });
}
