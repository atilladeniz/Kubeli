use kube::config::Kubeconfig;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OidcExecConfig {
    pub issuer_url: String,
    pub client_id: String,
    pub extra_scopes: Vec<String>,
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

    Some(OidcExecConfig {
        issuer_url,
        client_id,
        extra_scopes,
    })
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
            if let Some(next) = args.get(idx + 1) {
                if !next.is_empty() {
                    values.push(next.clone());
                }
                idx += 2;
                continue;
            }
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
}
