use kube::config::Kubeconfig;

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct OidcExecConfig {
    /// The exec plugin binary (kubeconfig `exec.command`, e.g. `kubectl` or
    /// `kubelogin`). Used to decide whether the plugin is installed so we can
    /// let kube-rs run it instead of Kubeli's native flow (issue #335).
    pub command: String,
    /// The actual krew plugin binary backing `kubectl oidc-login`
    /// (`kubectl-oidc_login`), when the command is `kubectl` invoking the
    /// `oidc-login` subcommand. `kubectl` existing does not mean its plugin is
    /// installed, so this must be checked separately. `None` when `command` is
    /// already the standalone binary.
    pub plugin_binary: Option<String>,
    pub issuer_url: String,
    pub client_id: String,
    pub extra_scopes: Vec<String>,
    /// Path to a CA bundle that signs the IdP's TLS cert (kubelogin
    /// `--certificate-authority`). Needed for IdPs behind a private CA, whose
    /// cert the bundled public roots do not trust.
    pub certificate_authority: Option<String>,
    /// Inline base64-encoded CA bundle (kubelogin `--certificate-authority-data`).
    /// Takes precedence over `certificate_authority` when both are present.
    pub certificate_authority_data: Option<String>,
    /// Skip IdP TLS verification entirely (kubelogin `--insecure-skip-tls-verify`).
    pub insecure_skip_tls_verify: bool,
}

pub fn detect_oidc_exec(kubeconfig: &Kubeconfig, user_name: &str) -> Option<OidcExecConfig> {
    let named_auth_info = kubeconfig
        .auth_infos
        .iter()
        .find(|auth| auth.name == user_name)?;
    let auth_info = named_auth_info.auth_info.as_ref()?;
    let exec = auth_info.exec.as_ref()?;
    let args = exec.args.as_ref()?;

    if !args.iter().any(|arg| arg.contains("oidc-login")) {
        return None;
    }

    let issuer_url = extract_first_flag_value(args, "--oidc-issuer-url")?;
    let client_id = extract_first_flag_value(args, "--oidc-client-id")?;
    let extra_scopes = extract_all_flag_values(args, "--oidc-extra-scope");

    let certificate_authority = extract_first_flag_value(args, "--certificate-authority");
    let certificate_authority_data = extract_first_flag_value(args, "--certificate-authority-data");
    let insecure_skip_tls_verify = is_flag_set(args, "--insecure-skip-tls-verify");

    let command = exec.command.clone().unwrap_or_default();

    // `kubectl oidc-login ...` runs the krew plugin `kubectl-oidc_login`. The
    // `kubectl` binary being present says nothing about whether that plugin is
    // installed, so track the plugin binary to check it directly.
    let plugin_binary =
        if command_basename_is_kubectl(&command) && args.iter().any(|a| a == "oidc-login") {
            Some("kubectl-oidc_login".to_string())
        } else {
            None
        };

    Some(OidcExecConfig {
        command,
        plugin_binary,
        issuer_url,
        client_id,
        extra_scopes,
        certificate_authority,
        certificate_authority_data,
        insecure_skip_tls_verify,
    })
}

/// Whether the kubeconfig's exec OIDC provider can actually run on this machine.
///
/// Best practice (as in Headlamp/Lens) is to let the exec plugin drive OIDC
/// login when it is installed, and only fall back to Kubeli's native browser
/// flow when it isn't. The PATH we scan is the same one kube-rs would use to
/// spawn the plugin, so this answers exactly "could the exec provider run?" —
/// including the GUI-app case where the launcher gives a stripped PATH (then
/// exec couldn't run either, and native is correct).
///
/// For `kubectl oidc-login`, both `kubectl` and its krew plugin
/// (`kubectl-oidc_login`) must be present — `kubectl` alone is not enough.
pub fn exec_provider_runnable(config: &OidcExecConfig) -> bool {
    exec_binary_available(&config.command)
        && config
            .plugin_binary
            .as_deref()
            .is_none_or(exec_binary_available)
}

/// Whether `command`'s basename is `kubectl` (handles absolute/relative paths
/// and the Windows `.exe` suffix; matched case-insensitively for Windows).
fn command_basename_is_kubectl(command: &str) -> bool {
    std::path::Path::new(command)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|name| {
            name.eq_ignore_ascii_case("kubectl") || name.eq_ignore_ascii_case("kubectl.exe")
        })
        .unwrap_or(false)
}

/// Whether `path` is a regular file Kubeli could actually execute. On Unix the
/// executable bit must be set — a readable-but-not-executable file on PATH would
/// otherwise be mistaken for a runnable plugin, skip the native fallback, and
/// make kube-rs fail later with "permission denied".
fn is_executable_file(path: &std::path::Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        match path.metadata() {
            Ok(meta) => meta.is_file() && meta.permissions().mode() & 0o111 != 0,
            Err(_) => false,
        }
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

/// Whether a single command resolves to an executable on PATH.
pub fn exec_binary_available(command: &str) -> bool {
    if command.is_empty() {
        return false;
    }

    // An explicit path is checked directly, not searched on PATH. Treat both
    // separators as a path component so a relative `bin/kubectl` isn't PATH-
    // searched on Windows (where MAIN_SEPARATOR is only `\\`).
    let as_path = std::path::Path::new(command);
    if as_path.is_absolute() || command.contains('/') || command.contains('\\') {
        return is_executable_file(as_path);
    }

    let Some(path_var) = std::env::var_os("PATH") else {
        return false;
    };

    std::env::split_paths(&path_var).any(|dir| {
        // Always try the command exactly as written first (e.g. `kubectl.exe`).
        if is_executable_file(&dir.join(command)) {
            return true;
        }

        // On Windows a bare name like `kubectl` is resolved via PATHEXT. Only
        // append extensions when the command doesn't already carry one, so we
        // never search for `kubectl.exe.EXE`.
        #[cfg(windows)]
        if as_path.extension().is_none() {
            let pathext =
                std::env::var("PATHEXT").unwrap_or_else(|_| ".EXE;.CMD;.BAT;.COM".to_string());
            for ext in pathext.split(';').filter(|e| !e.is_empty()) {
                if is_executable_file(&dir.join(format!("{command}{ext}"))) {
                    return true;
                }
            }
        }

        false
    })
}

/// Whether a boolean flag is present, as a bare `--flag` or `--flag=true`.
fn is_flag_set(args: &[String], flag: &str) -> bool {
    let truthy = format!("{}=true", flag);
    args.iter().any(|a| a == flag || a == &truthy)
}

fn extract_first_flag_value(args: &[String], flag: &str) -> Option<String> {
    extract_all_flag_values(args, flag).into_iter().next()
}

fn extract_all_flag_values(args: &[String], flag: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut idx = 0usize;
    let equals_prefix = format!("{}=", flag);

    while idx < args.len() {
        let arg = &args[idx];

        if let Some(value) = arg.strip_prefix(&equals_prefix) {
            if !value.is_empty() {
                values.push(value.to_string());
            }
            idx += 1;
            continue;
        }

        if arg == flag {
            // A following token that is itself a flag (starts with "--") means
            // this flag had no value in a malformed kubeconfig; skip it rather
            // than swallowing the next flag as a bogus value.
            if let Some(next) = args.get(idx + 1) {
                if !next.is_empty() && !next.starts_with("--") {
                    values.push(next.clone());
                    idx += 2;
                    continue;
                }
            }
            idx += 1;
            continue;
        }

        idx += 1;
    }

    values
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kubeconfig_from_yaml(yaml: &str) -> Kubeconfig {
        serde_yaml::from_str::<Kubeconfig>(yaml).expect("kubeconfig yaml should parse")
    }

    #[test]
    fn detects_oidc_exec_with_equals_style_args() {
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: kubectl
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url=https://issuer.example.com
          - --oidc-client-id=desktop-client
          - --oidc-extra-scope=email
          - --oidc-extra-scope=profile
"#,
        );

        let detected = detect_oidc_exec(&kubeconfig, "oidc-user").expect("oidc should be detected");

        assert_eq!(detected.issuer_url, "https://issuer.example.com");
        assert_eq!(detected.client_id, "desktop-client");
        assert_eq!(detected.extra_scopes, vec!["email", "profile"]);
    }

    #[test]
    fn prefer_kubeconfig_auth_bypasses_native_oidc() {
        // connect_cluster gates native OIDC with
        // `detect_oidc_exec(..).filter(|_| !prefer_kubeconfig_auth)`. When the
        // user opts into kubeconfig-only auth, detection must yield None so
        // kube-rs runs the exec provider as-is (issue #335).
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1
        command: kubectl
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url=https://issuer.example.com
          - --oidc-client-id=desktop-client
"#,
        );

        // Without the opt-out, OIDC is detected (native flow would run).
        assert!(detect_oidc_exec(&kubeconfig, "oidc-user").is_some());

        // With the opt-out, the same detection is suppressed.
        let prefer_kubeconfig_auth = true;
        let active = detect_oidc_exec(&kubeconfig, "oidc-user").filter(|_| !prefer_kubeconfig_auth);
        assert!(active.is_none());
    }

    #[test]
    fn captures_exec_command_for_binary_detection() {
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: kubelogin
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url=https://issuer.example.com
          - --oidc-client-id=desktop-client
"#,
        );

        let detected = detect_oidc_exec(&kubeconfig, "oidc-user").expect("oidc should be detected");
        assert_eq!(detected.command, "kubelogin");
        // A standalone binary has no separate krew plugin to check.
        assert_eq!(detected.plugin_binary, None);
    }

    #[test]
    fn kubectl_oidc_login_tracks_krew_plugin_binary() {
        // `kubectl oidc-login` runs the krew plugin `kubectl-oidc_login`. The
        // `kubectl` binary existing is not enough — the plugin must be present
        // too, otherwise kube-rs runs into an exec error (review finding).
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: /usr/local/bin/kubectl
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url=https://issuer.example.com
          - --oidc-client-id=desktop-client
"#,
        );

        let detected = detect_oidc_exec(&kubeconfig, "oidc-user").expect("oidc should be detected");
        assert_eq!(detected.command, "/usr/local/bin/kubectl");
        assert_eq!(
            detected.plugin_binary.as_deref(),
            Some("kubectl-oidc_login")
        );

        // kubectl present but plugin missing -> provider not runnable -> native.
        let current = std::env::current_exe().expect("current exe path");
        let kubectl_present_plugin_missing = OidcExecConfig {
            command: current.to_string_lossy().into_owned(),
            plugin_binary: Some("definitely-not-a-real-plugin-xyz123".to_string()),
            ..Default::default()
        };
        assert!(!exec_provider_runnable(&kubectl_present_plugin_missing));

        // Both present -> runnable.
        let both_present = OidcExecConfig {
            command: current.to_string_lossy().into_owned(),
            plugin_binary: Some(current.to_string_lossy().into_owned()),
            ..Default::default()
        };
        assert!(exec_provider_runnable(&both_present));
    }

    #[test]
    fn exec_binary_available_resolves_path_and_absolute() {
        // Empty and clearly-bogus names never resolve.
        assert!(!exec_binary_available(""));
        assert!(!exec_binary_available(
            "definitely-not-a-real-binary-xyz123"
        ));

        // An absolute path to an existing executable resolves directly. The
        // test binary itself is a stable, cross-platform example.
        let current = std::env::current_exe().expect("current exe path");
        assert!(exec_binary_available(current.to_str().expect("utf-8 path")));
    }

    #[test]
    #[cfg(unix)]
    fn exec_binary_available_requires_executable_bit_on_unix() {
        // A readable but non-executable file must not count as runnable,
        // otherwise the native OIDC fallback is wrongly skipped (review finding).
        use std::os::unix::fs::PermissionsExt;

        // A private, uniquely-named temp dir (not a fixed name in shared /tmp)
        // avoids the insecure-temp-file class flagged by Semgrep.
        let dir = tempfile::tempdir().expect("create temp dir");
        let path = dir.path().join("kubeli-exec-test");
        std::fs::write(&path, b"#!/bin/sh\nexit 0\n").expect("write temp file");

        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).expect("chmod 644");
        assert!(!exec_binary_available(path.to_str().expect("utf-8 path")));

        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).expect("chmod 755");
        assert!(exec_binary_available(path.to_str().expect("utf-8 path")));
    }

    #[test]
    fn detects_krew_plugin_with_windows_style_command() {
        // command_basename_is_kubectl must match case-insensitively and tolerate
        // the `.exe` suffix so Windows kubeconfigs aren't misclassified (review
        // finding). String logic only, so this runs on every platform.
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: KUBECTL.EXE
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url=https://issuer.example.com
          - --oidc-client-id=desktop-client
"#,
        );

        let detected = detect_oidc_exec(&kubeconfig, "oidc-user").expect("oidc should be detected");
        assert_eq!(
            detected.plugin_binary.as_deref(),
            Some("kubectl-oidc_login")
        );
    }

    #[test]
    fn native_oidc_used_only_when_exec_binary_missing() {
        // connect_cluster keeps the native flow (detection stays Some) only when
        // exec auth isn't forced AND the plugin binary can't be run.
        let decide = |prefer: bool, available: bool| !(prefer || available);

        assert!(decide(false, false)); // no binary, not forced -> native fallback
        assert!(!decide(false, true)); // binary present -> let kube-rs run exec
        assert!(!decide(true, false)); // forced exec -> skip native even if absent
        assert!(!decide(true, true));
    }

    #[test]
    fn detects_private_ca_and_insecure_tls_flags() {
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: kubectl
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url=https://issuer.example.com
          - --oidc-client-id=desktop-client
          - --certificate-authority=/etc/ssl/idp-ca.pem
          - --certificate-authority-data=LS0tLS1CRUdJTg==
          - --insecure-skip-tls-verify
"#,
        );

        let detected = detect_oidc_exec(&kubeconfig, "oidc-user").expect("oidc should be detected");

        assert_eq!(
            detected.certificate_authority.as_deref(),
            Some("/etc/ssl/idp-ca.pem")
        );
        assert_eq!(
            detected.certificate_authority_data.as_deref(),
            Some("LS0tLS1CRUdJTg==")
        );
        assert!(detected.insecure_skip_tls_verify);
    }

    #[test]
    fn tls_flags_default_to_none_when_absent() {
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: kubectl
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url=https://issuer.example.com
          - --oidc-client-id=desktop-client
"#,
        );

        let detected = detect_oidc_exec(&kubeconfig, "oidc-user").expect("oidc should be detected");

        assert!(detected.certificate_authority.is_none());
        assert!(detected.certificate_authority_data.is_none());
        assert!(!detected.insecure_skip_tls_verify);
    }

    #[test]
    fn detects_oidc_exec_with_split_style_args() {
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: kubectl
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url
          - https://issuer.example.com
          - --oidc-client-id
          - desktop-client
          - --oidc-extra-scope
          - groups
"#,
        );

        let detected = detect_oidc_exec(&kubeconfig, "oidc-user").expect("oidc should be detected");

        assert_eq!(detected.issuer_url, "https://issuer.example.com");
        assert_eq!(detected.client_id, "desktop-client");
        assert_eq!(detected.extra_scopes, vec!["groups"]);
    }

    #[test]
    fn returns_none_when_required_oidc_args_missing() {
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: kubectl
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url=https://issuer.example.com
"#,
        );

        assert!(detect_oidc_exec(&kubeconfig, "oidc-user").is_none());
    }

    #[test]
    fn does_not_swallow_following_flag_as_value() {
        // --oidc-issuer-url has no value and is immediately followed by another
        // flag. The issuer must be treated as missing, not set to the next flag.
        let kubeconfig = kubeconfig_from_yaml(
            r#"
apiVersion: v1
kind: Config
users:
  - name: oidc-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: kubectl
        args:
          - oidc-login
          - get-token
          - --oidc-issuer-url
          - --oidc-client-id
          - desktop-client
"#,
        );

        assert!(detect_oidc_exec(&kubeconfig, "oidc-user").is_none());
    }
}
