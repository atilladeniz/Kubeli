// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// objc 0.2 macros use cfg(feature = "cargo-clippy") internally
#![allow(unexpected_cfgs)]

mod ai;
mod app;
mod commands;
mod error;
mod k8s;
mod mcp;
mod network;
mod oidc;

fn main() {
    let args = app::bootstrap::initialize();

    if args.mcp {
        app::bootstrap::install_rustls_provider();
        app::bootstrap::run_mcp_server();
        return;
    }

    app::bootstrap::install_rustls_provider();
    app::builder::run();
}
