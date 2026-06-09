use super::*;
use std::path::PathBuf;

fn write_kubeconfig(dir: &std::path::Path, name: &str, content: &str) -> PathBuf {
    let path = dir.join(name);
    std::fs::write(&path, content).unwrap();
    path
}

const KUBECONFIG_A: &str = r#"
apiVersion: v1
kind: Config
current-context: ctx-a
clusters:
- name: cluster-a
  cluster:
    server: https://cluster-a:6443
contexts:
- name: ctx-a
  context:
    cluster: cluster-a
    user: user-a
users:
- name: user-a
  user:
    token: token-a
"#;

const KUBECONFIG_B: &str = r#"
apiVersion: v1
kind: Config
current-context: ctx-b
clusters:
- name: cluster-b
  cluster:
    server: https://cluster-b:6443
contexts:
- name: ctx-b
  context:
    cluster: cluster-b
    user: user-b
users:
- name: user-b
  user:
    token: token-b
"#;

#[test]
fn test_merge_single_file() {
    let dir = tempfile::tempdir().unwrap();
    let f = write_kubeconfig(dir.path(), "config.yaml", KUBECONFIG_A);

    let result = merge_kubeconfig_files(&[f]).unwrap();
    assert_eq!(result.contexts.len(), 1);
    assert_eq!(result.contexts[0].name, "ctx-a");
    assert_eq!(result.clusters.len(), 1);
    assert_eq!(result.auth_infos.len(), 1);
    assert_eq!(result.current_context, Some("ctx-a".to_string()));
}

#[test]
fn test_merge_multiple_files_all_contexts_accessible() {
    let dir = tempfile::tempdir().unwrap();
    let f1 = write_kubeconfig(dir.path(), "cluster-a.yaml", KUBECONFIG_A);
    let f2 = write_kubeconfig(dir.path(), "cluster-b.yaml", KUBECONFIG_B);

    let result = merge_kubeconfig_files(&[f1, f2]).unwrap();

    // Both contexts must be present (this was the bug — only default file was read)
    assert_eq!(result.contexts.len(), 2);
    let ctx_names: Vec<&str> = result.contexts.iter().map(|c| c.name.as_str()).collect();
    assert!(ctx_names.contains(&"ctx-a"));
    assert!(ctx_names.contains(&"ctx-b"));

    // Both clusters and auth_infos merged
    assert_eq!(result.clusters.len(), 2);
    assert_eq!(result.auth_infos.len(), 2);
}

#[test]
fn test_merge_current_context_from_first_file() {
    let dir = tempfile::tempdir().unwrap();
    let f1 = write_kubeconfig(dir.path(), "first.yaml", KUBECONFIG_A);
    let f2 = write_kubeconfig(dir.path(), "second.yaml", KUBECONFIG_B);

    let result = merge_kubeconfig_files(&[f1, f2]).unwrap();
    assert_eq!(result.current_context, Some("ctx-a".to_string()));

    // Reverse order: ctx-b should be current
    let dir2 = tempfile::tempdir().unwrap();
    let f3 = write_kubeconfig(dir2.path(), "first.yaml", KUBECONFIG_B);
    let f4 = write_kubeconfig(dir2.path(), "second.yaml", KUBECONFIG_A);

    let result2 = merge_kubeconfig_files(&[f3, f4]).unwrap();
    assert_eq!(result2.current_context, Some("ctx-b".to_string()));
}

#[test]
fn test_merge_skips_invalid_files() {
    let dir = tempfile::tempdir().unwrap();
    let bad = write_kubeconfig(dir.path(), "bad.yaml", "not: valid: yaml: [[[");
    let good = write_kubeconfig(dir.path(), "good.yaml", KUBECONFIG_A);

    let result = merge_kubeconfig_files(&[bad, good]).unwrap();
    assert_eq!(result.contexts.len(), 1);
    assert_eq!(result.contexts[0].name, "ctx-a");
}

#[test]
fn test_merge_skips_nonexistent_files() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("nonexistent.yaml");
    let good = write_kubeconfig(dir.path(), "good.yaml", KUBECONFIG_B);

    let result = merge_kubeconfig_files(&[missing, good]).unwrap();
    assert_eq!(result.contexts.len(), 1);
    assert_eq!(result.contexts[0].name, "ctx-b");
}

#[test]
fn test_merge_no_valid_files_returns_error() {
    let dir = tempfile::tempdir().unwrap();
    let bad = write_kubeconfig(dir.path(), "bad.yaml", "garbage content");

    let result = merge_kubeconfig_files(&[bad]);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .contains("No valid kubeconfig files could be parsed"));
}

#[test]
fn test_merge_empty_file_list_returns_error() {
    let result = merge_kubeconfig_files(&[]);
    assert!(result.is_err());
}

#[test]
fn test_merge_context_can_be_found_by_name() {
    let dir = tempfile::tempdir().unwrap();
    let f1 = write_kubeconfig(dir.path(), "a.yaml", KUBECONFIG_A);
    let f2 = write_kubeconfig(dir.path(), "b.yaml", KUBECONFIG_B);

    let merged = merge_kubeconfig_files(&[f1, f2]).unwrap();

    // Simulate what init_with_context does: find context by name
    let found_a = merged.contexts.iter().find(|c| c.name == "ctx-a");
    let found_b = merged.contexts.iter().find(|c| c.name == "ctx-b");
    assert!(found_a.is_some(), "ctx-a must be findable in merged config");
    assert!(found_b.is_some(), "ctx-b must be findable in merged config");

    // Verify auth_infos are also accessible (needed for client creation)
    let user_a = merged.auth_infos.iter().find(|u| u.name == "user-a");
    let user_b = merged.auth_infos.iter().find(|u| u.name == "user-b");
    assert!(user_a.is_some(), "user-a must be findable");
    assert!(user_b.is_some(), "user-b must be findable");
}

#[test]
fn test_merge_duplicate_context_first_wins() {
    let dir = tempfile::tempdir().unwrap();
    let f1 = write_kubeconfig(dir.path(), "first.yaml", KUBECONFIG_A);
    // Second file reuses context name "ctx-a" but with a different cluster
    let duplicate = r#"
apiVersion: v1
kind: Config
current-context: ctx-a
clusters:
- name: other-cluster
  cluster:
    server: https://other:6443
contexts:
- name: ctx-a
  context:
    cluster: other-cluster
    user: other-user
users:
- name: other-user
  user:
    token: other-token
"#;
    let f2 = write_kubeconfig(dir.path(), "second.yaml", duplicate);

    let merged = merge_kubeconfig_files(&[f1, f2]).unwrap();
    // Only one context with name "ctx-a" (first file wins)
    let matching: Vec<_> = merged
        .contexts
        .iter()
        .filter(|c| c.name == "ctx-a")
        .collect();
    assert_eq!(matching.len(), 1);
    // The cluster reference should be from the first file
    assert_eq!(
        matching[0].context.as_ref().unwrap().cluster,
        "cluster-a",
        "first file's cluster reference must win"
    );
}

/// Demonstrates the name collision bug (#283): when multiple kubeconfig files
/// define users/clusters with the same name (e.g. "admin"), merge keeps only
/// the first file's entry. The fix is to load only the source file for a context.
#[test]
fn test_merge_same_user_name_causes_collision() {
    let dir = tempfile::tempdir().unwrap();

    let file1 = r#"
apiVersion: v1
kind: Config
clusters:
- name: cluster-1
  cluster:
    server: https://cluster-1:6443
contexts:
- name: ctx-1
  context:
    cluster: cluster-1
    user: admin
users:
- name: admin
  user:
    token: token-for-cluster-1
"#;
    let file2 = r#"
apiVersion: v1
kind: Config
clusters:
- name: cluster-2
  cluster:
    server: https://cluster-2:6443
contexts:
- name: ctx-2
  context:
    cluster: cluster-2
    user: admin
users:
- name: admin
  user:
    token: token-for-cluster-2
"#;

    let f1 = write_kubeconfig(dir.path(), "cluster-1.yaml", file1);
    let f2 = write_kubeconfig(dir.path(), "cluster-2.yaml", file2);

    // Merged config: both contexts exist, but only one "admin" user entry
    let merged = merge_kubeconfig_files(&[f1.clone(), f2.clone()]).unwrap();
    assert_eq!(merged.contexts.len(), 2, "both contexts should be present");

    // The "admin" user from file1 shadows file2's "admin" - this is the bug.
    // kube-rs merge deduplicates auth_infos by name, keeping the first.
    let admin_count = merged
        .auth_infos
        .iter()
        .filter(|a| a.name == "admin")
        .count();
    assert_eq!(
        admin_count, 1,
        "merge deduplicates by name - only one 'admin' survives"
    );

    // Similarly, cluster names can collide if both files use the same name
    let cluster_count = merged
        .clusters
        .iter()
        .filter(|c| c.name == "cluster-1" || c.name == "cluster-2")
        .count();
    assert_eq!(cluster_count, 2, "different cluster names are preserved");

    // Fix: loading only the source file for a context avoids the collision.
    // Each file has its own "admin" user with the correct credentials.
    let single = Kubeconfig::read_from(&f2).unwrap();
    assert_eq!(single.auth_infos.len(), 1);
    assert_eq!(single.auth_infos[0].name, "admin");
    assert_eq!(single.contexts.len(), 1);
    assert_eq!(single.contexts[0].name, "ctx-2");
}

#[test]
fn test_merge_resolves_relative_cert_paths() {
    let dir = tempfile::tempdir().unwrap();

    // Write a CA file next to the kubeconfig
    let ca_path = dir.path().join("ca.crt");
    std::fs::write(&ca_path, "fake-ca-data").unwrap();

    // Kubeconfig with relative certificate-authority path
    let config_with_relative = r#"
apiVersion: v1
kind: Config
clusters:
- name: rel-cluster
  cluster:
    server: https://rel:6443
    certificate-authority: ca.crt
contexts:
- name: rel-ctx
  context:
    cluster: rel-cluster
    user: rel-user
users:
- name: rel-user
  user:
    token: rel-token
"#;
    let f = write_kubeconfig(dir.path(), "rel.yaml", config_with_relative);

    let merged = merge_kubeconfig_files(&[f]).unwrap();
    let cluster = merged
        .clusters
        .iter()
        .find(|c| c.name == "rel-cluster")
        .unwrap();
    let ca = cluster
        .cluster
        .as_ref()
        .unwrap()
        .certificate_authority
        .as_ref()
        .unwrap();

    // The relative path "ca.crt" must be resolved to an absolute path
    assert!(
        std::path::Path::new(ca).is_absolute(),
        "certificate-authority must be resolved to absolute path, got: {}",
        ca
    );
    assert!(
        ca.ends_with("ca.crt"),
        "resolved path must still point to ca.crt, got: {}",
        ca
    );
}

#[test]
fn test_is_self_contained_complete_file() {
    let dir = tempfile::tempdir().unwrap();
    let f = write_kubeconfig(dir.path(), "complete.yaml", KUBECONFIG_A);
    let cfg = Kubeconfig::read_from(&f).unwrap();
    assert!(
        is_self_contained(&cfg, "ctx-a"),
        "file with matching context, cluster, and user is self-contained"
    );
}

#[test]
fn test_is_self_contained_missing_context() {
    let dir = tempfile::tempdir().unwrap();
    let f = write_kubeconfig(dir.path(), "complete.yaml", KUBECONFIG_A);
    let cfg = Kubeconfig::read_from(&f).unwrap();
    assert!(
        !is_self_contained(&cfg, "nonexistent"),
        "unknown context is not self-contained"
    );
}

#[test]
fn test_is_self_contained_cross_file_references() {
    let dir = tempfile::tempdir().unwrap();

    // Context references a cluster and user defined in OTHER files
    let contexts_only = r#"
apiVersion: v1
kind: Config
contexts:
- name: cross-ctx
  context:
    cluster: external-cluster
    user: external-user
"#;
    let f = write_kubeconfig(dir.path(), "contexts-only.yaml", contexts_only);
    let cfg = Kubeconfig::read_from(&f).unwrap();
    assert!(
        !is_self_contained(&cfg, "cross-ctx"),
        "context with cross-file cluster/user references is not self-contained"
    );
}
