#!/usr/bin/env bash
# k8s-scale.sh - Create/delete N dummy pods for scale testing
# Uses minimal pause containers to test Kubeli's performance with many resources

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
NAMESPACE="kubeli-scale-test"
BATCH_SIZE=50  # Apply pods in batches to avoid API overload

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME <command> [options]

Commands:
  create <N>     Create N dummy pods in batches
  delete         Delete all scale-test pods
  status         Show current scale-test status

Options:
  -n, --namespace NS  Namespace to use (default: $NAMESPACE)
  -b, --batch SIZE    Batch size for creation (default: $BATCH_SIZE)
  -h, --help          Show this help message

Examples:
  $SCRIPT_NAME create 100          # Create 100 pods
  $SCRIPT_NAME create 500 -b 100   # Create 500 pods in batches of 100
  $SCRIPT_NAME delete              # Remove all scale-test pods
  $SCRIPT_NAME status              # Check current pod count

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

    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
}

ensure_namespace() {
    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        log_info "Creating namespace $NAMESPACE..."
        kubectl create namespace "$NAMESPACE"

        # Apply quota and limits from template
        if [[ -f ".dev/k8s-samples/16-scale-pods.yaml" ]]; then
            kubectl apply -f .dev/k8s-samples/16-scale-pods.yaml 2>/dev/null || true
        fi
    fi
}

create_pods() {
    local count="$1"
    local batch_id
    batch_id=$(date +%s)

    if [[ ! "$count" =~ ^[0-9]+$ ]] || [[ "$count" -lt 1 ]]; then
        log_error "Invalid count: $count (must be positive integer)"
        exit 1
    fi

    if [[ "$count" -gt 500 ]]; then
        log_warn "Creating $count pods may take a while and stress minikube"
        log_warn "Consider using a smaller number for initial testing"
        read -p "Continue? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi

    ensure_namespace

    log_info "Creating $count dummy pods in namespace $NAMESPACE..."
    log_info "Batch ID: $batch_id, Batch size: $BATCH_SIZE"

    local created=0
    local failed=0
    local batch_num=0

    while [[ $created -lt $count ]]; do
        batch_num=$((batch_num + 1))
        local batch_end=$((created + BATCH_SIZE))
        if [[ $batch_end -gt $count ]]; then
            batch_end=$count
        fi

        local batch_yaml=""

        for ((i = created; i < batch_end; i++)); do
            local pod_name="scale-pod-$batch_id-$i"
            batch_yaml+="---
apiVersion: v1
kind: Pod
metadata:
  name: $pod_name
  namespace: $NAMESPACE
  labels:
    app: scale-test
    app.kubernetes.io/part-of: kubeli-testing
    batch: \"$batch_id\"
spec:
  containers:
    - name: pause
      image: registry.k8s.io/pause:3.9
      resources:
        requests:
          cpu: 5m
          memory: 16Mi
        limits:
          cpu: 10m
          memory: 32Mi
  restartPolicy: Never
  terminationGracePeriodSeconds: 0
"
        done

        # Apply batch
        if echo "$batch_yaml" | kubectl apply -f - >/dev/null 2>&1; then
            local batch_count=$((batch_end - created))
            created=$batch_end
            log_info "Batch $batch_num: Created pods $((created - batch_count + 1))-$created"
        else
            log_warn "Batch $batch_num had some failures, continuing..."
            created=$batch_end
            failed=$((failed + 1))
        fi

        # Small delay between batches to not overwhelm the API
        if [[ $created -lt $count ]]; then
            sleep 0.5
        fi
    done

    log_success "Created $created pods (batch ID: $batch_id)"

    if [[ $failed -gt 0 ]]; then
        log_warn "$failed batches had partial failures"
    fi

    show_status
}

delete_pods() {
    log_info "Deleting all scale-test pods in namespace $NAMESPACE..."

    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        log_warn "Namespace $NAMESPACE does not exist"
        return 0
    fi

    local pod_count
    pod_count=$(kubectl get pods -n "$NAMESPACE" -l app=scale-test --no-headers 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$pod_count" -eq 0 ]]; then
        log_info "No scale-test pods to delete"
        return 0
    fi

    log_info "Deleting $pod_count pods..."

    # Delete all pods with the scale-test label
    kubectl delete pods -n "$NAMESPACE" -l app=scale-test --grace-period=0 --force 2>/dev/null || true

    # Wait for deletion
    local wait_count=0
    while [[ $wait_count -lt 30 ]]; do
        local remaining
        remaining=$(kubectl get pods -n "$NAMESPACE" -l app=scale-test --no-headers 2>/dev/null | wc -l | tr -d ' ')
        if [[ "$remaining" -eq 0 ]]; then
            break
        fi
        log_info "Waiting for $remaining pods to terminate..."
        sleep 1
        wait_count=$((wait_count + 1))
    done

    log_success "Scale-test pods deleted"
}

show_status() {
    log_info "Scale test status:"
    echo

    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        echo "  Namespace: $NAMESPACE (not found)"
        return 0
    fi

    local total_pods
    local running_pods
    local pending_pods

    total_pods=$(kubectl get pods -n "$NAMESPACE" -l app=scale-test --no-headers 2>/dev/null | wc -l | tr -d ' ')
    running_pods=$(kubectl get pods -n "$NAMESPACE" -l app=scale-test --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
    pending_pods=$(kubectl get pods -n "$NAMESPACE" -l app=scale-test --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')

    echo "  Namespace: $NAMESPACE"
    echo "  Total scale-test pods: $total_pods"
    echo "  Running: $running_pods"
    echo "  Pending: $pending_pods"

    # Show batches
    local batches
    batches=$(kubectl get pods -n "$NAMESPACE" -l app=scale-test -o jsonpath='{.items[*].metadata.labels.batch}' 2>/dev/null | tr ' ' '\n' | sort -u | grep -v '^$' || true)

    if [[ -n "$batches" ]]; then
        echo
        echo "  Batches:"
        for batch in $batches; do
            local batch_count
            batch_count=$(kubectl get pods -n "$NAMESPACE" -l "batch=$batch" --no-headers 2>/dev/null | wc -l | tr -d ' ')
            echo "    - $batch: $batch_count pods"
        done
    fi

    # Show resource usage
    echo
    local quota
    quota=$(kubectl get resourcequota -n "$NAMESPACE" -o jsonpath='{.items[0].status}' 2>/dev/null || true)
    if [[ -n "$quota" ]]; then
        echo "  Resource quota:"
        kubectl get resourcequota -n "$NAMESPACE" 2>/dev/null | tail -n +2 | while read -r line; do
            echo "    $line"
        done
    fi
}

# Main
check_prerequisites

COMMAND="${1:-}"
shift || true

COUNT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -b|--batch)
            BATCH_SIZE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [[ -z "$COUNT" ]] && [[ "$1" =~ ^[0-9]+$ ]]; then
                COUNT="$1"
            fi
            shift
            ;;
    esac
done

case "$COMMAND" in
    create)
        if [[ -z "$COUNT" ]]; then
            log_error "Please specify number of pods to create"
            echo "Usage: $SCRIPT_NAME create <N>"
            exit 1
        fi
        create_pods "$COUNT"
        ;;
    delete)
        delete_pods
        ;;
    status)
        show_status
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
