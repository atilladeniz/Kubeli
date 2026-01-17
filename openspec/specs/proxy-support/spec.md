# Proxy Support Specification

## Purpose
Enable Kubeli to connect to Kubernetes clusters through HTTP and SOCKS proxies for users in corporate environments or restricted networks.

## Requirements

### Requirement: HTTP Proxy Support
The system SHALL support connecting through HTTP/HTTPS proxies.

#### Scenario: Configure HTTP proxy
- GIVEN the user is in Settings > Network
- WHEN they enter an HTTP proxy URL
- THEN the proxy configuration is saved
- AND all cluster connections use the proxy

#### Scenario: Proxy with authentication
- GIVEN an HTTP proxy requires authentication
- WHEN the user enters username and password
- THEN credentials are stored securely
- AND authentication is performed on connection

#### Scenario: Proxy bypass list
- GIVEN a proxy is configured
- WHEN the user adds addresses to bypass list
- THEN those addresses connect directly without proxy

### Requirement: SOCKS Proxy Support
The system SHALL support SOCKS4 and SOCKS5 proxies.

#### Scenario: Configure SOCKS proxy
- GIVEN the user is in Settings > Network
- WHEN they select SOCKS proxy type and enter address
- THEN the SOCKS proxy configuration is saved

#### Scenario: SOCKS5 authentication
- GIVEN a SOCKS5 proxy requires authentication
- WHEN the user enters credentials
- THEN authentication is handled correctly

### Requirement: System Proxy Detection
The system SHALL detect and optionally use system proxy settings.

#### Scenario: Auto-detect system proxy
- GIVEN the OS has proxy settings configured
- WHEN Kubeli starts
- THEN system proxy settings are detected
- AND the user can choose to use them

#### Scenario: macOS proxy settings
- GIVEN the user is on macOS
- WHEN system proxy is enabled
- THEN Kubeli reads from System Preferences

#### Scenario: Windows proxy settings
- GIVEN the user is on Windows
- WHEN system proxy is enabled
- THEN Kubeli reads from Internet Options

#### Scenario: Linux proxy environment
- GIVEN the user is on Linux
- WHEN HTTP_PROXY/HTTPS_PROXY env vars are set
- THEN Kubeli uses those settings

### Requirement: Per-Cluster Proxy Settings
The system SHALL allow different proxy settings per cluster.

#### Scenario: Cluster-specific proxy
- GIVEN multiple clusters are configured
- WHEN the user sets a proxy for a specific cluster
- THEN only that cluster uses the specified proxy

#### Scenario: Override global proxy
- GIVEN a global proxy is configured
- WHEN a cluster has its own proxy setting
- THEN the cluster-specific setting takes precedence

### Requirement: Proxy Connection Testing
The system SHALL allow testing proxy connectivity.

#### Scenario: Test proxy connection
- GIVEN proxy settings are entered
- WHEN the user clicks "Test Connection"
- THEN connectivity to the proxy is verified
- AND success or error message is shown

#### Scenario: Test cluster through proxy
- GIVEN proxy is configured for a cluster
- WHEN the user tests the cluster connection
- THEN the connection is tested through the proxy

## IPC Commands

```typescript
invoke('proxy:get_settings'): Promise<ProxySettings>

invoke('proxy:set_settings', {
  settings: ProxySettings
}): Promise<void>

invoke('proxy:get_system_proxy'): Promise<SystemProxyInfo | null>

invoke('proxy:test_connection', {
  proxy: ProxyConfig
}): Promise<ProxyTestResult>

invoke('proxy:get_cluster_proxy', {
  cluster_name: string
}): Promise<ProxyConfig | null>

invoke('proxy:set_cluster_proxy', {
  cluster_name: string,
  proxy: ProxyConfig | null
}): Promise<void>
```

## Data Model

```typescript
interface ProxySettings {
  enabled: boolean;
  useSystemProxy: boolean;
  globalProxy?: ProxyConfig;
  bypassList: string[];  // e.g., ["localhost", "127.0.0.1", "*.local"]
}

interface ProxyConfig {
  type: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  auth?: ProxyAuth;
}

interface ProxyAuth {
  username: string;
  password: string;  // Stored encrypted
}

interface SystemProxyInfo {
  detected: boolean;
  http?: {
    host: string;
    port: number;
  };
  https?: {
    host: string;
    port: number;
  };
  socks?: {
    host: string;
    port: number;
    version: 4 | 5;
  };
  bypass: string[];
}

interface ProxyTestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
}
```

## Backend Implementation

### Rust Module Structure
```
src-tauri/src/
├── commands/
│   └── proxy.rs        # Tauri command handlers
└── network/
    ├── mod.rs
    ├── proxy.rs        # Proxy configuration
    └── system_proxy.rs # System proxy detection
```

### Required Dependencies
```toml
[dependencies]
# HTTP client with proxy support
reqwest = { version = "0.12", features = ["json", "rustls-tls", "socks"] }

# Proxy support for hyper
hyper-http-proxy = "1.1"
hyper-socks2 = "0.9"

# System proxy detection
system-configuration = "0.6"  # macOS
winreg = "0.52"               # Windows
```

### kube-rs Proxy Integration
```rust
use kube::{Client, Config};
use reqwest::Proxy;

async fn create_client_with_proxy(
    config: Config,
    proxy_config: &ProxyConfig,
) -> Result<Client> {
    let proxy = match proxy_config.type_ {
        ProxyType::Http | ProxyType::Https => {
            Proxy::all(format!("http://{}:{}", proxy_config.host, proxy_config.port))?
        }
        ProxyType::Socks5 => {
            Proxy::all(format!("socks5://{}:{}", proxy_config.host, proxy_config.port))?
        }
        // ...
    };

    let https = config.rustls_https_connector()?;
    let service = tower::ServiceBuilder::new()
        .layer(ProxyLayer::new(proxy))
        .service(https);

    Ok(Client::new(service, config.default_namespace))
}
```

## Frontend Components

### Settings UI
```
src/components/features/settings/
├── NetworkSettings.tsx     # Main network settings tab
├── ProxyConfigForm.tsx     # Proxy configuration form
└── ProxyTestButton.tsx     # Connection test component
```

### UI Layout
```
Network Settings
├── [ ] Use system proxy (Auto-detected: http://proxy.corp.com:8080)
├── Manual Configuration
│   ├── Proxy Type: [HTTP ▼]
│   ├── Host: [________________]
│   ├── Port: [____]
│   ├── Authentication
│   │   ├── Username: [________________]
│   │   └── Password: [________________]
│   └── [Test Connection]
└── Bypass List
    └── [localhost, 127.0.0.1, *.local]
```

## Security Considerations

### Credential Storage
- Proxy passwords stored in OS keychain
- Never logged or displayed in plain text
- Cleared from memory after use

### Proxy Security
- Warn if using HTTP proxy with sensitive clusters
- Prefer HTTPS proxy when available
- Validate proxy certificates

## Platform-Specific Notes

### macOS
- Read from `scutil --proxy`
- System Preferences > Network > Proxies

### Windows
- Read from Registry: `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`
- Or via WinHTTP API

### Linux
- Environment variables: `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`
- GNOME: gsettings
- KDE: kreadconfig5

## Priority

This is a **P3 (Nice to Have)** feature for enterprise users.

## Dependencies

- Integrates with cluster connection from Task 2
- Settings storage from Task 9
- Required for corporate/enterprise environments
