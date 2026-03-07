use clap::Parser;
use std::env;

#[derive(Parser, Debug)]
#[command(name = "kubeli")]
#[command(author, version, about, long_about = None)]
pub struct Args {
    /// Run as MCP (Model Context Protocol) server for IDE integration
    #[arg(long)]
    pub mcp: bool,
}

pub fn initialize() -> Args {
    install_macos_panic_hook();
    extend_path_with_common_cli_dirs();
    Args::parse()
}

pub fn install_rustls_provider() {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");
}

pub fn run_mcp_server() {
    let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
    rt.block_on(async {
        if let Err(error) = crate::mcp::run_mcp_server().await {
            eprintln!("MCP server error: {}", error);
            std::process::exit(1);
        }
    });
}

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
        if candidate.exists() && !paths.iter().any(|path| path == &candidate) {
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

fn install_macos_panic_hook() {
    #[cfg(target_os = "macos")]
    {
        let default_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            let msg = info.payload().downcast_ref::<&str>().copied().unwrap_or("");
            let loc = info
                .location()
                .map(|location| location.file())
                .unwrap_or("");

            if msg.contains("cannot unwind")
                || loc.contains("app_delegate")
                || (crate::app::tray::app_quit_requested() && loc.contains("panicking"))
            {
                extern "C" {
                    fn _exit(status: i32) -> !;
                }
                unsafe { _exit(0) };
            }

            default_hook(info);
        }));
    }
}
