#!/usr/bin/env bash
# oidc-dev.sh - Local OIDC test stack for Kubeli.
#
# Brings up an HTTPS Dex provider plus a dedicated minikube profile whose
# apiserver trusts it, so a Kubeli OIDC sign-in goes all the way to a green,
# authenticated connect. Driven by `make oidc-dev` / `make oidc-dev-stop`.
#
# Moving parts (handled for you):
#   * kube-apiserver only accepts an HTTPS OIDC issuer -> Dex serves TLS with a
#     generated dev CA.
#   * The issuer host must resolve to Dex from BOTH the host (browser + Kubeli)
#     and the apiserver (inside the minikube node). We use host.minikube.internal:
#     the node resolves it natively to the host gateway; the host gets one
#     /etc/hosts line (added with sudo).
#   * Three consumers trust the dev CA: the apiserver (--oidc-ca-file), Kubeli
#     (--certificate-authority in the exec args), and your browser (proceed past
#     the warning once).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CERT_DIR="$REPO_DIR/.dev/oidc/certs"
DEX_CONFIG="$REPO_DIR/.dev/oidc/dex-config-tls.yaml"
DEX_IMAGE="${DEX_IMAGE:-ghcr.io/dexidp/dex:v2.41.1}"
DEX_CONTAINER="kubeli-dex"
DEX_PORT="5556"
ISSUER_HOST="host.minikube.internal"
ISSUER="https://${ISSUER_HOST}:${DEX_PORT}/dex"
DISCOVERY="${ISSUER}/.well-known/openid-configuration"

PROFILE="kubeli-oidc"
LOGIN_USER="kubeli-oidc-login"
OIDC_EMAIL="dev@kubeli.test"
CLIENT_ID="kubeli"
NODE_CA_PATH="/var/lib/minikube/certs/oidc-dex-ca.crt"
MINIKUBE_FILES_CA="$HOME/.minikube/files${NODE_CA_PATH}"
KUBECONFIG_FILE="${KUBECONFIG:-$HOME/.kube/config}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log_info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

require() { command -v "$1" >/dev/null 2>&1 || { log_error "$1 is required but not installed."; exit 1; }; }

gen_certs() {
  if [ -f "$CERT_DIR/dex.crt" ] && [ -f "$CERT_DIR/ca.crt" ]; then
    log_info "Reusing existing dev certificates in .dev/oidc/certs/"
    return
  fi
  require openssl
  mkdir -p "$CERT_DIR"
  log_info "Generating dev CA and Dex server certificate (SAN: $ISSUER_HOST)..."
  openssl genrsa -out "$CERT_DIR/ca.key" 2048 >/dev/null 2>&1
  openssl req -x509 -new -nodes -key "$CERT_DIR/ca.key" -sha256 -days 365 \
    -subj "/CN=Kubeli OIDC Dev CA" -out "$CERT_DIR/ca.crt" >/dev/null 2>&1

  cat > "$CERT_DIR/san.cnf" <<SAN
[req]
distinguished_name = dn
req_extensions = v3
[dn]
[v3]
subjectAltName = DNS:${ISSUER_HOST},DNS:localhost,IP:127.0.0.1
SAN

  openssl genrsa -out "$CERT_DIR/dex.key" 2048 >/dev/null 2>&1
  openssl req -new -key "$CERT_DIR/dex.key" -subj "/CN=${ISSUER_HOST}" \
    -out "$CERT_DIR/dex.csr" -config "$CERT_DIR/san.cnf" >/dev/null 2>&1
  openssl x509 -req -in "$CERT_DIR/dex.csr" -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" \
    -CAcreateserial -out "$CERT_DIR/dex.crt" -days 365 -sha256 \
    -extensions v3 -extfile "$CERT_DIR/san.cnf" >/dev/null 2>&1
  log_success "Certificates written to .dev/oidc/certs/"
}

ensure_hosts() {
  if grep -qE "^[^#]*[[:space:]]${ISSUER_HOST}([[:space:]]|\$)" /etc/hosts; then
    log_info "/etc/hosts already maps $ISSUER_HOST"
    return
  fi
  log_warn "Adding '127.0.0.1 $ISSUER_HOST' to /etc/hosts (needs sudo)..."
  echo "127.0.0.1 $ISSUER_HOST" | sudo tee -a /etc/hosts >/dev/null
  log_success "Host entry added."
}

place_ca_for_minikube() {
  mkdir -p "$(dirname "$MINIKUBE_FILES_CA")"
  cp "$CERT_DIR/ca.crt" "$MINIKUBE_FILES_CA"
  log_info "CA staged for minikube at ~/.minikube/files${NODE_CA_PATH}"
}

dex_up() {
  require docker
  docker rm -f "$DEX_CONTAINER" >/dev/null 2>&1 || true
  log_info "Starting HTTPS Dex ($DEX_IMAGE) on :${DEX_PORT}..."
  docker run -d --name "$DEX_CONTAINER" -p "${DEX_PORT}:${DEX_PORT}" \
    -v "${DEX_CONFIG}:/etc/dex/config.yaml:ro" \
    -v "${CERT_DIR}/dex.crt:/etc/dex/tls.crt:ro" \
    -v "${CERT_DIR}/dex.key:/etc/dex/tls.key:ro" \
    "$DEX_IMAGE" dex serve /etc/dex/config.yaml >/dev/null

  printf '%b' "${CYAN}[INFO]${NC} Waiting for Dex HTTPS discovery"
  for _ in $(seq 1 30); do
    if curl -sf --cacert "$CERT_DIR/ca.crt" --resolve "${ISSUER_HOST}:${DEX_PORT}:127.0.0.1" \
         "$DISCOVERY" >/dev/null 2>&1; then
      echo " ready"; log_success "Dex serving $ISSUER"; return 0
    fi
    printf '.'; sleep 1
  done
  echo; log_error "Dex did not become ready. Check: docker logs $DEX_CONTAINER"; exit 1
}

cluster_up() {
  require minikube
  require kubectl
  if minikube profile list -o json 2>/dev/null | grep -q "\"Name\":\"$PROFILE\""; then
    if minikube status -p "$PROFILE" -o json 2>/dev/null | grep -q '"APIServer":"Running"'; then
      # Already up — skip `minikube start`, which does a full (slow) reconcile
      # even on a running cluster. The apiserver keeps its OIDC flags.
      log_info "minikube profile '$PROFILE' already running."
    else
      log_info "minikube profile '$PROFILE' exists but is stopped; starting..."
      minikube start -p "$PROFILE" >/dev/null
    fi
  else
    log_info "Starting minikube profile '$PROFILE' with apiserver OIDC trust..."
    minikube start -p "$PROFILE" --driver=docker \
      --extra-config=apiserver.oidc-issuer-url="$ISSUER" \
      --extra-config=apiserver.oidc-client-id="$CLIENT_ID" \
      --extra-config=apiserver.oidc-username-claim=email \
      --extra-config=apiserver.oidc-ca-file="$NODE_CA_PATH" >/dev/null
  fi

  # RBAC must run as the embedded cert admin. On a re-run, context_up has
  # already repointed the kubeli-oidc context at the OIDC user, so a bare
  # `kubectl --context kubeli-oidc` would try to invoke kubelogin (which we
  # don't require — Kubeli does its own OIDC flow). update-context refreshes a
  # stale apiserver port; then point the context back at the cert-admin user
  # (named after the profile) just for the RBAC call. context_up repoints to
  # the OIDC user afterwards.
  minikube update-context -p "$PROFILE" >/dev/null
  kubectl config set-context "$PROFILE" --cluster="$PROFILE" --user="$PROFILE" >/dev/null

  log_info "Granting the OIDC user cluster-admin (demo RBAC)..."
  kubectl --context "$PROFILE" create clusterrolebinding kubeli-oidc-admin \
    --clusterrole=cluster-admin --user="$OIDC_EMAIL" \
    --dry-run=client -o yaml | kubectl --context "$PROFILE" apply -f - >/dev/null
  log_success "minikube profile '$PROFILE' ready"
}

context_up() {
  # Repoint the profile's own context at an OIDC sign-in user, so Kubeli shows a
  # single "kubeli-oidc" cluster that connects via OIDC — not the extra cert
  # admin that `minikube start` creates. RBAC above already ran via that admin.
  # --certificate-authority points Kubeli at the dev CA (Kubeli's OIDC client
  # only trusts public roots otherwise).
  kubectl --kubeconfig "$KUBECONFIG_FILE" config set-credentials "$LOGIN_USER" \
    --exec-api-version=client.authentication.k8s.io/v1beta1 \
    --exec-command=kubectl \
    --exec-arg=oidc-login \
    --exec-arg=get-token \
    --exec-arg="--oidc-issuer-url=${ISSUER}" \
    --exec-arg="--oidc-client-id=${CLIENT_ID}" \
    --exec-arg=--oidc-extra-scope=email \
    --exec-arg=--oidc-extra-scope=offline_access \
    --exec-arg="--certificate-authority=${CERT_DIR}/ca.crt" >/dev/null
  kubectl --kubeconfig "$KUBECONFIG_FILE" config set-context "$PROFILE" \
    --cluster="$PROFILE" --user="$LOGIN_USER" >/dev/null
  log_success "Context '$PROFILE' now signs in via OIDC (single cluster in Kubeli)"
}

print_next_steps() {
  cat <<EOF

$(echo -e "${GREEN}Local OIDC stack ready.${NC}")

  Issuer  : $ISSUER   (client: $CLIENT_ID)
  Login    : $OIDC_EMAIL  /  password
  Context  : $PROFILE   (signs in via OIDC)

Next:
  1. Build & open the app so the kubeli:// scheme is registered:
       make build && open src-tauri/target/release/bundle/macos/Kubeli.app
  2. In Kubeli, connect to "$PROFILE".
  3. Browser opens Dex (accept the dev cert warning) -> log in -> connect goes green.

Tear down with:  make oidc-dev-stop
EOF
}

down() {
  docker rm -f "$DEX_CONTAINER" >/dev/null 2>&1 && log_success "Dex removed." || log_info "Dex not running."
  if command -v minikube >/dev/null 2>&1; then
    minikube delete -p "$PROFILE" >/dev/null 2>&1 && log_success "minikube profile '$PROFILE' deleted." || true
  fi
  if command -v kubectl >/dev/null 2>&1; then
    # minikube delete removes the kubeli-oidc context/cluster; drop the orphan
    # OIDC user it leaves behind.
    kubectl --kubeconfig "$KUBECONFIG_FILE" config unset "users.${LOGIN_USER}" >/dev/null 2>&1 \
      && log_success "Removed OIDC user '$LOGIN_USER'." || true
  fi
  rm -f "$MINIKUBE_FILES_CA"
  log_info "Left the /etc/hosts entry and .dev/oidc/certs/ in place (remove manually if desired)."
}

case "${1:-up}" in
  up)
    gen_certs
    ensure_hosts
    place_ca_for_minikube
    dex_up
    cluster_up
    context_up
    print_next_steps
    ;;
  down) down ;;
  *) echo "Usage: $(basename "$0") {up|down}"; exit 1 ;;
esac
