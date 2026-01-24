#!/bin/bash
# Creates a kubeconfig for remote access to minikube from Windows VM
# Run this on your Mac

set -e

# Get Mac's IP address (for UTM, usually the bridge interface)
MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.64.1")

echo "Mac IP: $MAC_IP"

# Get minikube certificates
MINIKUBE_HOME="${MINIKUBE_HOME:-$HOME/.minikube}"
CA_CERT="$MINIKUBE_HOME/ca.crt"
CLIENT_CERT="$MINIKUBE_HOME/profiles/minikube/client.crt"
CLIENT_KEY="$MINIKUBE_HOME/profiles/minikube/client.key"

# Check if minikube is running
if ! minikube status > /dev/null 2>&1; then
    echo "Error: minikube is not running. Start it with: minikube start"
    exit 1
fi

# Get the API server port (usually 8443)
API_PORT=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' | sed 's|.*:\([0-9]*\)$|\1|')

# Create output directory
OUTPUT_DIR="$(dirname "$0")/kubeconfig-remote"
mkdir -p "$OUTPUT_DIR"

# Copy certificates
cp "$CA_CERT" "$OUTPUT_DIR/ca.crt"
cp "$CLIENT_CERT" "$OUTPUT_DIR/client.crt"
cp "$CLIENT_KEY" "$OUTPUT_DIR/client.key"

# Create kubeconfig
cat > "$OUTPUT_DIR/config" << EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority: ca.crt
    server: https://${MAC_IP}:${API_PORT}
  name: minikube-remote
contexts:
- context:
    cluster: minikube-remote
    user: minikube-remote
  name: minikube-remote
current-context: minikube-remote
users:
- name: minikube-remote
  user:
    client-certificate: client.crt
    client-key: client.key
EOF

echo ""
echo "========================================="
echo "Kubeconfig created in: $OUTPUT_DIR"
echo "========================================="
echo ""
echo "On Windows VM, copy the entire folder to:"
echo "  C:\\Users\\<username>\\.kube\\"
echo ""
echo "Then rename 'config' to 'config' (no extension)"
echo ""
echo "IMPORTANT: You need to expose the minikube API server."
echo "Run this on Mac:"
echo ""
echo "  # Option 1: SSH tunnel (recommended)"
echo "  minikube tunnel"
echo ""
echo "  # Option 2: Port forward"
echo "  kubectl port-forward --address 0.0.0.0 -n kube-system svc/kubernetes 8443:443"
echo ""
