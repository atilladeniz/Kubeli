# Kubeli - Connect to Remote Minikube
# Run this script in Windows VM to connect to Mac's minikube
#
# Usage:
#   .\connect-minikube.ps1 -HostIP 192.168.64.1
#   .\connect-minikube.ps1  # Uses default from .env or prompts

param(
    [string]$HostIP = "",
    [int]$Port = 8001
)

# ASCII banner
Write-Host ""
Write-Host "+--------------------------------------+"
Write-Host "|   Kubeli - Remote Minikube Connect   |"
Write-Host "+--------------------------------------+"
Write-Host ""

# Try to get IP from .env if not provided
$EnvFile = Join-Path $PSScriptRoot ".env"
if (-not $HostIP -and (Test-Path $EnvFile)) {
    $envContent = Get-Content $EnvFile
    foreach ($line in $envContent) {
        if ($line -match "^MINIKUBE_HOST_IP=(.+)$") {
            $HostIP = $matches[1].Trim('"').Trim("'")
            Write-Host "[*] Using IP from .env: $HostIP" -ForegroundColor Cyan
            break
        }
    }
}

# Prompt for IP if still not set
if (-not $HostIP) {
    Write-Host "[!] No HostIP provided and no .env file found." -ForegroundColor Yellow
    Write-Host ""
    $HostIP = Read-Host "Enter Mac's IP address (shown in 'make minikube-serve' output)"

    if (-not $HostIP) {
        Write-Host "[ERROR] IP address is required!" -ForegroundColor Red
        exit 1
    }

    # Optionally save to .env
    $save = Read-Host "Save this IP to .env for future use? [Y/n]"
    if ($save -ne "n" -and $save -ne "N") {
        "MINIKUBE_HOST_IP=$HostIP" | Out-File -FilePath $EnvFile -Encoding UTF8
        Write-Host "[+] Saved to .env" -ForegroundColor Green
    }
}

$KubeServer = "http://${HostIP}:${Port}"

Write-Host ""
Write-Host "[*] Connecting to: $KubeServer" -ForegroundColor Cyan
Write-Host ""

# Check if kubectl is available
$kubectlPath = Get-Command kubectl -ErrorAction SilentlyContinue
if (-not $kubectlPath) {
    Write-Host "[!] kubectl not found. Installing via winget..." -ForegroundColor Yellow
    try {
        $process = Start-Process -FilePath "winget" -ArgumentList "install", "--id", "Kubernetes.kubectl", "--source", "winget", "--accept-source-agreements", "--accept-package-agreements", "-e" -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -ne 0) {
            Write-Host "[ERROR] Failed to install kubectl" -ForegroundColor Red
            exit 1
        }
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
    catch {
        Write-Host "[ERROR] Failed to install kubectl: $_" -ForegroundColor Red
        exit 1
    }
}

# Create .kube directory if it doesn't exist
$KubeDir = Join-Path $env:USERPROFILE ".kube"
if (-not (Test-Path $KubeDir)) {
    New-Item -ItemType Directory -Path $KubeDir -Force | Out-Null
    Write-Host "[+] Created $KubeDir" -ForegroundColor Green
}

# Create/update kubeconfig for remote minikube
$KubeConfig = Join-Path $KubeDir "config"

# Backup existing config if present
if (Test-Path $KubeConfig) {
    $backupPath = "${KubeConfig}.backup"
    Copy-Item -Path $KubeConfig -Destination $backupPath -Force
    Write-Host "[*] Backed up existing config to $backupPath" -ForegroundColor Cyan
}

# Create minimal kubeconfig for kubectl proxy connection
# Note: kubectl proxy doesn't require authentication
$kubeConfigContent = @"
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: $KubeServer
  name: minikube-remote
contexts:
- context:
    cluster: minikube-remote
    namespace: default
  name: minikube-remote
current-context: minikube-remote
users:
- name: minikube-remote

"@

$kubeConfigContent | Out-File -FilePath $KubeConfig -Encoding UTF8

Write-Host "[+] Updated kubeconfig at $KubeConfig" -ForegroundColor Green
Write-Host ""

# Test connection
Write-Host "[*] Testing connection..." -ForegroundColor Cyan
Write-Host ""

try {
    $result = kubectl cluster-info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[+] SUCCESS! Connected to remote minikube" -ForegroundColor Green
        Write-Host ""
        Write-Host $result
        Write-Host ""

        # Show some basic info
        Write-Host "[*] Namespaces:" -ForegroundColor Cyan
        kubectl get namespaces
        Write-Host ""

        Write-Host "[*] Nodes:" -ForegroundColor Cyan
        kubectl get nodes
        Write-Host ""

        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Ready! You can now use kubectl and Kubeli" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Try these commands:" -ForegroundColor Cyan
        Write-Host "  kubectl get pods -A"
        Write-Host "  kubectl get services -A"
        Write-Host ""
        Write-Host "To run Kubeli:" -ForegroundColor Cyan
        Write-Host "  Z:\src-tauri\target\x86_64-pc-windows-msvc\release\Kubeli.exe"
        Write-Host ""
    }
    else {
        Write-Host "[ERROR] Connection failed!" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "  1. Make sure 'make minikube-serve' is running on Mac"
        Write-Host "  2. Check that the IP address is correct: $HostIP"
        Write-Host "  3. Check Mac firewall allows connections on port $Port"
        Write-Host "  4. Try pinging the Mac: ping $HostIP"
        Write-Host ""
        exit 1
    }
}
catch {
    Write-Host "[ERROR] Failed to connect: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure 'make minikube-serve' is running on your Mac" -ForegroundColor Yellow
    exit 1
}
