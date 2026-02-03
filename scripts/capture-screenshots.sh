#!/usr/bin/env bash
# Capture screenshots of all Kubeli views using deep links.
# Requires: GetWindowID (brew install smokris/getwindowid/getwindowid)
# Optional: pngquant (brew install pngquant) for compression
# Usage: ./scripts/capture-screenshots.sh [output-dir]

set -euo pipefail

DIR="${1:-docs/screenshots}"
DELAY="${SCREENSHOT_DELAY:-2}"
CONNECT_DELAY="${SCREENSHOT_CONNECT_DELAY:-6}"
CONTEXT="${SCREENSHOT_CONTEXT:-minikube}"
# Deep links only work in debug builds (gated by #[cfg(debug_assertions)])
APP="src-tauri/target/debug/bundle/macos/Kubeli.app"

urlencode() {
  node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"
}

VIEWS=(
  cluster-overview
  resource-diagram
  nodes
  events
  namespaces
  leases
  helm-releases
  flux-kustomizations
  workloads-overview
  deployments
  pods
  replicasets
  daemonsets
  statefulsets
  jobs
  cronjobs
  port-forwards
  services
  ingresses
  endpoint-slices
  network-policies
  ingress-classes
  secrets
  configmaps
  hpa
  limit-ranges
  resource-quotas
  pod-disruption-budgets
  persistent-volumes
  persistent-volume-claims
  volume-attachments
  storage-classes
  csi-drivers
  csi-nodes
  service-accounts
  roles
  role-bindings
  cluster-roles
  cluster-role-bindings
  crds
  priority-classes
  runtime-classes
  mutating-webhooks
  validating-webhooks
)

mkdir -p "$DIR"

if [ ! -d "$APP" ]; then
  echo "Error: App not found at $APP. Run 'make screenshot-build' (or 'make screenshots') first."
  exit 1
fi

if ! command -v GetWindowID &>/dev/null; then
  echo "Error: GetWindowID not found. Run 'make screenshot-setup'."
  exit 1
fi

echo "Launching Kubeli..."
open "$APP"
sleep 4

WINDOW_ID=$(GetWindowID Kubeli "Kubeli" 2>/dev/null || true)
if [ -z "$WINDOW_ID" ]; then
  echo "Error: Could not find Kubeli window."
  exit 1
fi
echo "Window ID: $WINDOW_ID"

# Auto-connect to cluster
echo "Connecting to cluster: $CONTEXT..."
ENCODED_CONTEXT=$(urlencode "$CONTEXT")
open "kubeli://connect/$ENCODED_CONTEXT"
sleep "$CONNECT_DELAY"

# Capture all views
for view in "${VIEWS[@]}"; do
  echo "  Capturing: $view"
  ENCODED_VIEW=$(urlencode "$view")
  open "kubeli://view/$ENCODED_VIEW"
  sleep "$DELAY"
  screencapture -o -x -l"$WINDOW_ID" "$DIR/$view.png"
done

echo "Quitting Kubeli..."
osascript -e 'quit app "Kubeli"' 2>/dev/null || true

# Compress PNGs
if command -v pngquant &>/dev/null; then
  echo "Compressing screenshots with pngquant..."
  BEFORE=$(du -sh "$DIR" | cut -f1)
  pngquant --force --ext .png --quality=65-90 --skip-if-larger "$DIR"/*.png 2>/dev/null || true
  AFTER=$(du -sh "$DIR" | cut -f1)
  echo "  Before: $BEFORE → After: $AFTER"
else
  echo "Note: Install pngquant for compression (brew install pngquant)"
fi

echo "Done. ${#VIEWS[@]} screenshots saved to $DIR/"
