# Windows Development Setup for Kubeli

## Quick Start

### One-Line Setup (PowerShell)

```powershell
# Run directly from URL
irm https://kubeli.dev/setup-minikube.ps1 | iex
```

### Manual Setup

1. **Download the script:**
   ```powershell
   Invoke-WebRequest -Uri https://kubeli.dev/setup-minikube.ps1 -OutFile setup-minikube.ps1
   ```

2. **Run the script:**
   ```powershell
   .\setup-minikube.ps1
   ```

## Prerequisites

The script will check for these tools:

| Tool | Required | Install Command |
|------|----------|-----------------|
| minikube | Yes | `winget install Kubernetes.minikube` |
| kubectl | Yes | `winget install Kubernetes.kubectl` |
| Docker Desktop | Recommended | `winget install Docker.DockerDesktop` |

### Virtualization Options

Minikube needs a driver to run. The script auto-detects the best option:

1. **Docker Desktop** (recommended) - Easiest setup
2. **Hyper-V** - Built into Windows Pro/Enterprise
3. **WSL2 + Docker** - Good for development

## Script Options

```powershell
# Full setup with sample resources
.\setup-minikube.ps1

# Check current status
.\setup-minikube.ps1 -StatusOnly

# Start minikube without samples
.\setup-minikube.ps1 -SkipSamples

# Clean up everything
.\setup-minikube.ps1 -CleanOnly

# Show help
.\setup-minikube.ps1 -Help
```

## Sample Resources

The script creates the `kubeli-demo` namespace with:

| Resource | Name | Description |
|----------|------|-------------|
| Deployment | demo-web | 3 replicas of nginx |
| Deployment | demo-api | 2 replicas of http-echo |
| StatefulSet | demo-db | 1 replica of Redis |
| DaemonSet | demo-log-collector | Fluentd on each node |
| Job | demo-migration | One-time migration job |
| CronJob | demo-cleanup | Hourly cleanup job |
| Services | demo-web, demo-api | ClusterIP services |

## Remote Connection (UTM / No Virtualization)

If you're running Windows in a VM that doesn't support nested virtualization (like UTM on Apple Silicon), you can connect to minikube running on the Mac host.

### On Mac (Host)

```bash
# Start minikube if not running, then expose API
make minikube-serve
```

This starts a kubectl proxy that exposes the Kubernetes API on port 8001.

### On Windows (VM)

```powershell
# Navigate to shared folder (UTM mounts Mac folders to Z:)
cd Z:\.dev\windows

# Connect to Mac's minikube (IP shown in 'make minikube-serve' output)
.\connect-minikube.ps1 -HostIP 192.168.64.1
```

The script will:
1. Create/update kubeconfig for remote connection
2. Test the connection
3. Show available namespaces and nodes

### Save IP for Future Use

The connect script can save the IP to `.env`:
```powershell
# First run - will prompt to save
.\connect-minikube.ps1 -HostIP 192.168.64.1

# Future runs - uses saved IP
.\connect-minikube.ps1
```

## Troubleshooting

### Docker not starting

```powershell
# Restart Docker Desktop
Stop-Process -Name "Docker Desktop" -Force
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

### Minikube stuck

```powershell
# Delete and recreate cluster
minikube delete
.\setup-minikube.ps1
```

### Permission denied

Run PowerShell as Administrator, or set execution policy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Virtualization not supported (UTM / VMs)

If you see "Virtualization support not detected" when starting Docker Desktop, your VM doesn't support nested virtualization. This is common with:
- UTM on Apple Silicon
- VirtualBox without VT-x/AMD-V passthrough
- Some cloud VMs

**Solution:** Use the remote connection method - run minikube on the Mac host and connect from Windows. See "Remote Connection" section above.

## Manual kubectl Commands

```powershell
# View all resources in demo namespace
kubectl get all -n kubeli-demo

# Watch pods
kubectl get pods -n kubeli-demo -w

# View logs
kubectl logs -n kubeli-demo -l app=demo-web

# Open dashboard
minikube dashboard

# Get minikube IP
minikube ip
```

## Uninstall

```powershell
# Remove samples and stop minikube
.\setup-minikube.ps1 -CleanOnly

# Completely remove minikube
minikube delete --all --purge
```
