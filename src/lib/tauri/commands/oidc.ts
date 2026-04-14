import { invoke } from "./core";

interface OidcAuthResult {
  status: "authenticated" | "auth_pending" | "unauthenticated";
  auth_url: string | null;
  token: string | null;
}

export async function oidcStartAuth(
  issuerUrl: string,
  clientId: string,
  extraScopes: string[]
): Promise<OidcAuthResult> {
  return invoke<OidcAuthResult>("oidc_start_auth", {
    issuerUrl,
    clientId,
    extraScopes,
  });
}

export async function oidcHandleCallback(
  code: string,
  state: string
): Promise<OidcAuthResult> {
  return invoke<OidcAuthResult>("oidc_handle_callback", { code, state });
}

export async function oidcGetTokenStatus(
  issuerUrl: string,
  clientId: string
): Promise<OidcAuthResult> {
  return invoke<OidcAuthResult>("oidc_get_token_status", {
    issuerUrl,
    clientId,
  });
}
