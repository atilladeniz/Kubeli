import { invoke } from "./core";

// Network/Proxy commands
export interface ProxyConfig {
  proxyType: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export async function setProxyConfig(
  proxyType: string,
  host: string,
  port: number,
  username: string,
  password: string
): Promise<void> {
  return invoke("set_proxy_config", {
    proxyType,
    host,
    port,
    username,
    password,
  });
}

export async function getProxyConfig(): Promise<ProxyConfig> {
  return invoke<ProxyConfig>("get_proxy_config");
}
