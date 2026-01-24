#Requires -Version 5.1
<#
.SYNOPSIS
    Kubeli - Minikube Setup Script for Windows

.DESCRIPTION
    This script sets up a local Kubernetes development environment with minikube
    and sample resources for testing Kubeli.

    Run from URL:
    irm https://kubeli.atilla.app/setup-minikube.ps1 | iex

.NOTES
    Author: Kubeli Team
    Version: 1.0.0
    License: MIT
#>

param(
    [switch]$SkipSamples,
    [switch]$CleanOnly,
    [switch]$StatusOnly,
    [switch]$Help
)

# Colors
$Script:Colors = @{
    Cyan    = [ConsoleColor]::Cyan
    Green   = [ConsoleColor]::Green
    Yellow  = [ConsoleColor]::Yellow
    Red     = [ConsoleColor]::Red
    White   = [ConsoleColor]::White
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::White,
        [switch]$NoNewline
    )
    $params = @{
        Object = $Message
        ForegroundColor = $Color
    }
    if ($NoNewline) { $params.NoNewline = $true }
    Write-Host @params
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "`n>> $Message" -Color $Colors.Cyan
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[OK] $Message" -Color $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[!] $Message" -Color $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[X] $Message" -Color $Colors.Red
}

function Show-Banner {
    $banner = @"

    _  __     _          _ _
   | |/ /   _| |__   ___| (_)
   | ' / | | | '_ \ / _ \ | |
   | . \ |_| | |_) |  __/ | |
   |_|\_\__,_|_.__/ \___|_|_|

   Minikube Setup Script for Windows

"@
    Write-ColorOutput $banner -Color $Colors.Cyan
}

function Show-Help {
    Show-Banner
    @"
USAGE:
    .\setup-minikube.ps1 [OPTIONS]

OPTIONS:
    -Help           Show this help message
    -StatusOnly     Only show current status
    -SkipSamples    Start minikube without sample resources
    -CleanOnly      Remove sample resources and stop minikube

EXAMPLES:
    # Full setup with samples
    .\setup-minikube.ps1

    # Check status
    .\setup-minikube.ps1 -StatusOnly

    # Start without samples
    .\setup-minikube.ps1 -SkipSamples

    # Clean up
    .\setup-minikube.ps1 -CleanOnly

RUN FROM URL:
    irm https://kubeli.atilla.app/setup-minikube.ps1 | iex

"@
}

function Test-Command {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Install-WithWinget {
    param(
        [string]$PackageId,
        [string]$Name
    )

    Write-ColorOutput "Installing $Name..." -Color $Colors.Yellow

    # Check if winget is available
    if (-not (Test-Command 'winget')) {
        Write-Error "winget not found. Please install App Installer from Microsoft Store."
        return $false
    }

    try {
        $process = Start-Process -FilePath "winget" -ArgumentList "install", "--id", $PackageId, "--accept-source-agreements", "--accept-package-agreements", "-e" -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -eq 0) {
            Write-Success "$Name installed successfully"
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            return $true
        }
        else {
            Write-Error "Failed to install $Name (exit code: $($process.ExitCode))"
            return $false
        }
    }
    catch {
        Write-Error "Error installing $Name : $_"
        return $false
    }
}

function Test-Prerequisites {
    Write-Step "Checking prerequisites..."

    $requirements = @(
        @{
            Name = 'minikube'
            Required = $true
            InstallUrl = 'https://minikube.sigs.k8s.io/docs/start/'
            WingetId = 'Kubernetes.minikube'
        },
        @{
            Name = 'kubectl'
            Required = $true
            InstallUrl = 'https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/'
            WingetId = 'Kubernetes.kubectl'
        },
        @{
            Name = 'docker'
            Required = $false
            InstallUrl = 'https://docs.docker.com/desktop/install/windows-install/'
            WingetId = 'Docker.DockerDesktop'
        }
    )

    $allGood = $true
    $missing = @()

    foreach ($req in $requirements) {
        $cmd = $req.Name
        if (Test-Command $cmd) {
            $version = & $cmd version --short 2>$null
            if (-not $version) { $version = "installed" }
            Write-Success "$cmd - $version"
        }
        else {
            if ($req.Required) {
                Write-Error "$cmd - NOT FOUND (required)"
                $missing += $req
                $allGood = $false
            }
            else {
                Write-Warning "$cmd - not found (optional)"
            }
        }
    }

    # Check for Hyper-V or WSL2 (minikube drivers)
    Write-ColorOutput "`nChecking virtualization..." -Color $Colors.Cyan

    $hyperVFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -ErrorAction SilentlyContinue
    $hasHyperV = ($null -ne $hyperVFeature) -and ($hyperVFeature.State -eq 'Enabled')
    $hasWSL = Test-Command 'wsl'
    $hasDocker = Test-Command 'docker'

    if ($hasDocker) {
        Write-Success "Docker found - can use docker driver"
    }
    elseif ($hasHyperV) {
        Write-Success "Hyper-V enabled - can use hyperv driver"
    }
    elseif ($hasWSL) {
        Write-Success "WSL found - can use docker driver with WSL2"
    }
    else {
        Write-Warning "No virtualization driver found. Install Docker Desktop or enable Hyper-V."
    }

    # Auto-install missing tools
    if (-not $allGood -and $missing.Count -gt 0) {
        Write-ColorOutput "`nMissing required tools detected." -Color $Colors.Yellow
        Write-ColorOutput "Do you want to install them automatically with winget? [Y/n]: " -Color $Colors.Cyan -NoNewline
        $response = Read-Host

        if ($response -eq '' -or $response -match '^[Yy]') {
            foreach ($req in $missing) {
                $installed = Install-WithWinget -PackageId $req.WingetId -Name $req.Name
                if ($installed) {
                    $allGood = $true
                }
            }

            # Re-check after installation
            Write-Step "Verifying installation..."
            foreach ($req in $missing) {
                if (Test-Command $req.Name) {
                    Write-Success "$($req.Name) - now available"
                }
                else {
                    Write-Error "$($req.Name) - still not found. You may need to restart PowerShell."
                    $allGood = $false
                }
            }
        }
        else {
            Write-ColorOutput "`nManual installation:" -Color $Colors.Yellow
            foreach ($req in $missing) {
                Write-ColorOutput "  winget install $($req.WingetId)" -Color $Colors.White
            }
            Write-ColorOutput "`nOr visit:" -Color $Colors.Yellow
            foreach ($req in $missing) {
                Write-ColorOutput "  $($req.InstallUrl)" -Color $Colors.White
            }
            return $false
        }
    }

    return $allGood
}

function Get-MinikubeStatus {
    Write-Step "Checking minikube status..."

    $status = minikube status --format='{{.Host}}' 2>$null

    if ($status -eq 'Running') {
        Write-Success "Minikube is running"

        # Get cluster info
        $ip = minikube ip 2>$null
        $driver = minikube profile list -o json 2>$null | ConvertFrom-Json |
                  Where-Object { $_.Name -eq 'minikube' } |
                  Select-Object -ExpandProperty Driver -ErrorAction SilentlyContinue

        Write-ColorOutput "`nCluster Info:" -Color $Colors.Cyan
        Write-ColorOutput "  IP: $ip" -Color $Colors.White
        Write-ColorOutput "  Driver: $driver" -Color $Colors.White

        # Check sample namespace
        $ns = kubectl get namespace kubeli-demo -o name 2>$null
        if ($ns) {
            Write-ColorOutput "`nSample Resources (kubeli-demo namespace):" -Color $Colors.Cyan
            $pods = (kubectl get pods -n kubeli-demo --no-headers 2>$null | Measure-Object -Line).Lines
            $svcs = (kubectl get services -n kubeli-demo --no-headers 2>$null | Measure-Object -Line).Lines
            $deps = (kubectl get deployments -n kubeli-demo --no-headers 2>$null | Measure-Object -Line).Lines
            Write-ColorOutput "  Pods: $pods" -Color $Colors.White
            Write-ColorOutput "  Services: $svcs" -Color $Colors.White
            Write-ColorOutput "  Deployments: $deps" -Color $Colors.White
        }
        else {
            Write-Warning "Sample resources not installed. Run without -SkipSamples to install."
        }

        return $true
    }
    else {
        Write-Warning "Minikube is not running"
        return $false
    }
}

function Start-MinikubeCluster {
    Write-Step "Starting minikube..."

    # Determine best driver
    $driver = 'docker'  # Default
    if (-not (Test-Command 'docker')) {
        $hyperVFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -ErrorAction SilentlyContinue
        $hasHyperV = ($null -ne $hyperVFeature) -and ($hyperVFeature.State -eq 'Enabled')
        if ($hasHyperV) {
            $driver = 'hyperv'
        }
    }

    Write-ColorOutput "Using driver: $driver" -Color $Colors.White

    # Start minikube
    minikube start --driver=$driver --memory=4096 --cpus=2

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start minikube"
        return $false
    }

    Write-Success "Minikube started"

    # Enable addons
    Write-Step "Enabling addons..."

    minikube addons enable metrics-server
    Write-Success "metrics-server enabled"

    minikube addons enable ingress
    Write-Success "ingress enabled"

    # Wait for ingress controller
    Write-ColorOutput "Waiting for ingress controller..." -Color $Colors.Yellow
    kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s 2>$null

    return $true
}

function Install-SampleResources {
    Write-Step "Installing sample Kubernetes resources..."

    # Sample manifests - embedded for standalone execution
    $namespace = @"
apiVersion: v1
kind: Namespace
metadata:
  name: kubeli-demo
  labels:
    app.kubernetes.io/name: kubeli-demo
    app.kubernetes.io/managed-by: kubeli-setup
"@

    $deployment = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-web
  namespace: kubeli-demo
  labels:
    app: demo-web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: demo-web
  template:
    metadata:
      labels:
        app: demo-web
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-api
  namespace: kubeli-demo
  labels:
    app: demo-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo-api
  template:
    metadata:
      labels:
        app: demo-api
    spec:
      containers:
      - name: api
        image: hashicorp/http-echo
        args:
        - "-text=Hello from Kubeli API"
        ports:
        - containerPort: 5678
        resources:
          requests:
            memory: "32Mi"
            cpu: "25m"
          limits:
            memory: "64Mi"
            cpu: "50m"
"@

    $services = @"
apiVersion: v1
kind: Service
metadata:
  name: demo-web
  namespace: kubeli-demo
spec:
  selector:
    app: demo-web
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: demo-api
  namespace: kubeli-demo
spec:
  selector:
    app: demo-api
  ports:
  - port: 5678
    targetPort: 5678
  type: ClusterIP
"@

    $statefulset = @"
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: demo-db
  namespace: kubeli-demo
spec:
  serviceName: demo-db
  replicas: 1
  selector:
    matchLabels:
      app: demo-db
  template:
    metadata:
      labels:
        app: demo-db
    spec:
      containers:
      - name: redis
        image: redis:alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
"@

    $daemonset = @"
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: demo-log-collector
  namespace: kubeli-demo
spec:
  selector:
    matchLabels:
      app: demo-log-collector
  template:
    metadata:
      labels:
        app: demo-log-collector
    spec:
      containers:
      - name: fluentd
        image: fluent/fluentd:edge
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
"@

    $job = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: demo-migration
  namespace: kubeli-demo
spec:
  template:
    spec:
      containers:
      - name: migration
        image: busybox
        command: ["sh", "-c", "echo 'Running migration...' && sleep 5 && echo 'Done!'"]
      restartPolicy: Never
  backoffLimit: 1
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: demo-cleanup
  namespace: kubeli-demo
spec:
  schedule: "0 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: busybox
            command: ["sh", "-c", "echo 'Cleanup job'"]
          restartPolicy: OnFailure
"@

    # Apply manifests
    $namespace | kubectl apply -f - 2>$null
    Start-Sleep -Seconds 1

    $deployment | kubectl apply -f - 2>$null
    $services | kubectl apply -f - 2>$null
    $statefulset | kubectl apply -f - 2>$null
    $daemonset | kubectl apply -f - 2>$null
    $job | kubectl apply -f - 2>$null

    Write-Success "Sample resources installed"

    # Wait for pods
    Write-ColorOutput "Waiting for pods to be ready..." -Color $Colors.Yellow
    kubectl wait --for=condition=ready pod -l app=demo-web -n kubeli-demo --timeout=60s 2>$null
    kubectl wait --for=condition=ready pod -l app=demo-api -n kubeli-demo --timeout=60s 2>$null

    Write-Success "All pods ready"
}

function Remove-SampleResources {
    Write-Step "Removing sample resources..."

    kubectl delete namespace kubeli-demo --ignore-not-found 2>$null
    Write-Success "Sample resources removed"
}

function Stop-MinikubeCluster {
    Write-Step "Stopping minikube..."

    minikube stop
    Write-Success "Minikube stopped"
}

function Show-Summary {
    Write-ColorOutput "`n" -Color $Colors.White
    Write-ColorOutput "========================================" -Color $Colors.Green
    Write-ColorOutput "  Kubeli Development Environment Ready  " -Color $Colors.Green
    Write-ColorOutput "========================================" -Color $Colors.Green
    Write-ColorOutput "`nYou can now:" -Color $Colors.White
    Write-ColorOutput "  1. Start Kubeli and connect to minikube" -Color $Colors.White
    Write-ColorOutput "  2. Explore the kubeli-demo namespace" -Color $Colors.White
    Write-ColorOutput "`nUseful commands:" -Color $Colors.Cyan
    Write-ColorOutput "  minikube dashboard    - Open Kubernetes dashboard" -Color $Colors.White
    Write-ColorOutput "  minikube status       - Check cluster status" -Color $Colors.White
    Write-ColorOutput "  kubectl get pods -A   - List all pods" -Color $Colors.White
    Write-ColorOutput "`n"
}

# Main execution
function Main {
    if ($Help) {
        Show-Help
        return
    }

    Show-Banner

    if (-not (Test-Prerequisites)) {
        return
    }

    if ($StatusOnly) {
        Get-MinikubeStatus
        return
    }

    if ($CleanOnly) {
        Remove-SampleResources
        Stop-MinikubeCluster
        return
    }

    # Check if already running
    $isRunning = (minikube status --format='{{.Host}}' 2>$null) -eq 'Running'

    if (-not $isRunning) {
        if (-not (Start-MinikubeCluster)) {
            return
        }
    }
    else {
        Write-Success "Minikube already running"
    }

    if (-not $SkipSamples) {
        Install-SampleResources
    }

    Show-Summary
}

# Run
Main
