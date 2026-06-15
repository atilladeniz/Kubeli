use kube::config::Kubeconfig;

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct OidcExecConfig {
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

    Some(OidcExecConfig {
        issuer_url,
        client_id,
        extra_scopes,
        certificate_authority,
        certificate_authority_data,
        insecure_skip_tls_verify,
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
