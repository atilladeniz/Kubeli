#!/usr/bin/env bash
# kubeconfig-sim.sh - Simulate cloud provider kubeconfig contexts
# Creates fake EKS/GKE/AKS contexts pointing to local minikube cluster
# Also supports creating invalid-token contexts for auth error testing

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
KUBECONFIG_FILE="${KUBECONFIG:-$HOME/.kube/config}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME <command> [options]

Commands:
  create-eks [name]     Create fake EKS context (default: kubeli-eks-demo)
  create-gke [name]     Create fake GKE context (default: kubeli-gke-demo)
  create-aks [name]     Create fake AKS context (default: kubeli-aks-demo)
  create-auth-error     Create context with invalid token for auth testing
  create-same-user      Start 3 minikube profiles, export kubeconfigs with user "admin" (#283)
  list                  List all kubeli-* contexts
  cleanup               Remove all kubeli-* simulated contexts

Options:
  -s, --source CONTEXT  Source context to clone (default: minikube)
  -h, --help            Show this help message

Examples:
  $SCRIPT_NAME create-eks
  $SCRIPT_NAME create-gke my-gke-cluster --source minikube
  $SCRIPT_NAME create-auth-error
  $SCRIPT_NAME create-same-user
  $SCRIPT_NAME cleanup

EOF
    exit 0
}

log_info() {
    echo -e "${CYAN}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

check_prerequisites() {
    if ! command -v kubectl &>/dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
}

get_source_context() {
    local source="${1:-minikube}"

    if ! kubectl config get-contexts "$source" &>/dev/null; then
        log_error "Source context '$source' not found"
        log_info "Available contexts:"
        kubectl config get-contexts -o name
        exit 1
    fi

    echo "$source"
}

create_cloud_context() {
    local provider="$1"
    local context_name="$2"
    local source_context="$3"

    # Get cluster and user from source context
    local source_cluster
    local source_user
    source_cluster=$(kubectl config view -o jsonpath="{.contexts[?(@.name=='$source_context')].context.cluster}")
    source_user=$(kubectl config view -o jsonpath="{.contexts[?(@.name=='$source_context')].context.user}")

    if [[ -z "$source_cluster" ]]; then
        log_error "Could not find cluster for context '$source_context'"
        exit 1
    fi

    # Generate provider-specific naming
    local new_cluster_name
    local new_user_name
    local server_url

    server_url=$(kubectl config view -o jsonpath="{.clusters[?(@.name=='$source_cluster')].cluster.server}")

    case "$provider" in
        eks)
            # EKS format: arn:aws:eks:region:account:cluster/name
            new_cluster_name="arn:aws:eks:us-west-2:123456789012:cluster/$context_name"
            new_user_name="arn:aws:eks:us-west-2:123456789012:cluster/$context_name"
            ;;
        gke)
            # GKE format: gke_project_zone_name
            new_cluster_name="gke_kubeli-project_us-central1-a_$context_name"
            new_user_name="gke_kubeli-project_us-central1-a_$context_name"
            ;;
        aks)
            # AKS format: name (simple)
            new_cluster_name="$context_name"
            new_user_name="clusterUser_kubeli-rg_$context_name"
            ;;
        *)
            log_error "Unknown provider: $provider"
            exit 1
            ;;
    esac

    log_info "Creating $provider context: $context_name"

    # Clone the cluster config with new name
    local ca_data
    ca_data=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name=='$source_cluster')].cluster.certificate-authority-data}" 2>/dev/null || true)
    local ca_file
    ca_file=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name=='$source_cluster')].cluster.certificate-authority}" 2>/dev/null || true)

    if [[ -n "$ca_data" ]]; then
        kubectl config set-cluster "$new_cluster_name" \
            --server="$server_url" \
            --certificate-authority-data="$ca_data" \
            --embed-certs=true
    elif [[ -n "$ca_file" ]]; then
        kubectl config set-cluster "$new_cluster_name" \
            --server="$server_url" \
            --certificate-authority="$ca_file"
    else
        kubectl config set-cluster "$new_cluster_name" \
            --server="$server_url" \
            --insecure-skip-tls-verify=true
    fi

    # Clone user credentials
    local client_cert
    local client_key
    local client_cert_data
    local client_key_data

    client_cert_data=$(kubectl config view --raw -o jsonpath="{.users[?(@.name=='$source_user')].user.client-certificate-data}" 2>/dev/null || true)
    client_key_data=$(kubectl config view --raw -o jsonpath="{.users[?(@.name=='$source_user')].user.client-key-data}" 2>/dev/null || true)
    client_cert=$(kubectl config view --raw -o jsonpath="{.users[?(@.name=='$source_user')].user.client-certificate}" 2>/dev/null || true)
    client_key=$(kubectl config view --raw -o jsonpath="{.users[?(@.name=='$source_user')].user.client-key}" 2>/dev/null || true)

    if [[ -n "$client_cert_data" && -n "$client_key_data" ]]; then
        kubectl config set-credentials "$new_user_name" \
            --client-certificate-data="$client_cert_data" \
            --client-key-data="$client_key_data" \
            --embed-certs=true
    elif [[ -n "$client_cert" && -n "$client_key" ]]; then
        kubectl config set-credentials "$new_user_name" \
            --client-certificate="$client_cert" \
            --client-key="$client_key"
    fi

    # Create context
    kubectl config set-context "$context_name" \
        --cluster="$new_cluster_name" \
        --user="$new_user_name"

    log_success "Context '$context_name' created successfully"
    log_info "Switch with: kubectl config use-context $context_name"
}

create_auth_error_context() {
    local context_name="kubeli-auth-error"
    local cluster_name="kubeli-auth-error-cluster"
    local user_name="kubeli-auth-error-user"

    log_info "Creating auth-error context for testing..."

    # Get minikube server URL
    local server_url
    server_url=$(kubectl config view -o jsonpath="{.clusters[?(@.name=='minikube')].cluster.server}" 2>/dev/null || true)

    if [[ -z "$server_url" ]]; then
        log_warn "Minikube not found, using localhost"
        server_url="https://127.0.0.1:8443"
    fi

    # Create cluster with minikube's CA (so TLS works) but invalid credentials
    local ca_data
    ca_data=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name=='minikube')].cluster.certificate-authority-data}" 2>/dev/null || true)

    if [[ -n "$ca_data" ]]; then
        kubectl config set-cluster "$cluster_name" \
            --server="$server_url" \
            --certificate-authority-data="$ca_data"
    else
        kubectl config set-cluster "$cluster_name" \
            --server="$server_url" \
            --insecure-skip-tls-verify=true
    fi

    # Create user with invalid token
    kubectl config set-credentials "$user_name" \
        --token="invalid-token-for-testing-kubeli-auth-errors"

    # Create context
    kubectl config set-context "$context_name" \
        --cluster="$cluster_name" \
        --user="$user_name"

    log_success "Auth-error context '$context_name' created"
    log_info "This context will fail authentication when used"
    log_info "Switch with: kubectl config use-context $context_name"
}

create_same_user_files() {
    local output_dir="$HOME/.kube/kubeli-same-user"
    local profiles=("kubeli-nonprod" "kubeli-production" "kubeli-cicd")

    log_info "Creating 3 minikube profiles with separate clusters for #283 testing..."
    log_info "This starts real clusters - takes ~1-2 min per profile."
    echo ""

    # Start each minikube profile
    for profile in "${profiles[@]}"; do
        if minikube status -p "$profile" &>/dev/null; then
            log_info "Profile '$profile' already running, skipping start"
        else
            log_info "Starting minikube profile '$profile'..."
            minikube start -p "$profile" --memory=2048 --cpus=2 2>&1 | tail -1
        fi
    done

    mkdir -p "$output_dir"

    # Export each profile's kubeconfig with user renamed to "admin"
    for profile in "${profiles[@]}"; do
        local file="$output_dir/$profile.yaml"

        # Export raw kubeconfig for this profile only
        local raw
        raw=$(kubectl config view --raw --minify --context="$profile" 2>/dev/null)

        if [[ -z "$raw" ]]; then
            log_error "Could not export kubeconfig for profile '$profile'"
            continue
        fi

        # Write kubeconfig, renaming the user to "admin" to trigger name collision
        echo "$raw" \
            | sed "s/name: $profile\$/name: admin/" \
            | sed "s/user: $profile\$/user: admin/" \
            > "$file"

        log_success "Created $file (user renamed to 'admin')"
    done

    echo ""
    log_success "3 kubeconfig files created in $output_dir"
    log_info "Each file has a different cluster with different certs, but same user 'admin'"
    log_info "Add '$output_dir' as a folder source in Kubeli to test #283"
    log_info "Without the fix: only the first cluster connects (wrong certs for others)"
    log_info "With the fix: all 3 clusters connect successfully"
}

cleanup_same_user() {
    local profiles=("kubeli-nonprod" "kubeli-production" "kubeli-cicd")

    log_info "Stopping and deleting minikube profiles for #283 testing..."
    for profile in "${profiles[@]}"; do
        if minikube status -p "$profile" &>/dev/null; then
            minikube delete -p "$profile" 2>/dev/null || true
            log_success "Deleted profile '$profile'"
        fi
    done

    rm -rf "$HOME/.kube/kubeli-same-user" 2>/dev/null || true
    log_success "Removed kubeconfig files"
}

list_contexts() {
    log_info "Kubeli simulated contexts:"
    kubectl config get-contexts | grep -E "(CURRENT|kubeli-)" || echo "  No kubeli-* contexts found"
}

cleanup_contexts() {
    log_info "Cleaning up kubeli-* simulated contexts..."

    local contexts
    contexts=$(kubectl config get-contexts -o name | grep "^kubeli-" || true)

    if [[ -z "$contexts" ]]; then
        log_info "No kubeli-* contexts to remove"
        return 0
    fi

    for ctx in $contexts; do
        # Get cluster and user for this context
        local cluster
        local user
        cluster=$(kubectl config view -o jsonpath="{.contexts[?(@.name=='$ctx')].context.cluster}")
        user=$(kubectl config view -o jsonpath="{.contexts[?(@.name=='$ctx')].context.user}")

        log_info "Removing context: $ctx"
        kubectl config delete-context "$ctx" 2>/dev/null || true

        # Only delete cluster/user if they contain kubeli or the ARN patterns we created
        if [[ "$cluster" == *"kubeli"* ]] || [[ "$cluster" == arn:aws:eks:* ]] || [[ "$cluster" == gke_kubeli* ]]; then
            kubectl config delete-cluster "$cluster" 2>/dev/null || true
        fi
        if [[ "$user" == *"kubeli"* ]] || [[ "$user" == arn:aws:eks:* ]] || [[ "$user" == gke_kubeli* ]] || [[ "$user" == clusterUser_kubeli* ]]; then
            kubectl config delete-user "$user" 2>/dev/null || true
        fi
    done

    log_success "Cleanup complete"

    # Also clean up same-user profiles and files
    cleanup_same_user
}

# Main
check_prerequisites

COMMAND="${1:-}"
shift || true

SOURCE_CONTEXT="minikube"
CONTEXT_NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--source)
            SOURCE_CONTEXT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [[ -z "$CONTEXT_NAME" ]]; then
                CONTEXT_NAME="$1"
            fi
            shift
            ;;
    esac
done

case "$COMMAND" in
    create-eks)
        CONTEXT_NAME="${CONTEXT_NAME:-kubeli-eks-demo}"
        SOURCE_CONTEXT=$(get_source_context "$SOURCE_CONTEXT")
        create_cloud_context "eks" "$CONTEXT_NAME" "$SOURCE_CONTEXT"
        ;;
    create-gke)
        CONTEXT_NAME="${CONTEXT_NAME:-kubeli-gke-demo}"
        SOURCE_CONTEXT=$(get_source_context "$SOURCE_CONTEXT")
        create_cloud_context "gke" "$CONTEXT_NAME" "$SOURCE_CONTEXT"
        ;;
    create-aks)
        CONTEXT_NAME="${CONTEXT_NAME:-kubeli-aks-demo}"
        SOURCE_CONTEXT=$(get_source_context "$SOURCE_CONTEXT")
        create_cloud_context "aks" "$CONTEXT_NAME" "$SOURCE_CONTEXT"
        ;;
    create-auth-error)
        create_auth_error_context
        ;;
    create-same-user)
        create_same_user_files
        ;;
    list)
        list_contexts
        ;;
    cleanup)
        cleanup_contexts
        ;;
    -h|--help|help)
        usage
        ;;
    "")
        log_error "No command specified"
        usage
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        usage
        ;;
esac
