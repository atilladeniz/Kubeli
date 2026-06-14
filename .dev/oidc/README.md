# Local OIDC test stack

Two commands to test Kubeli's OIDC sign-in end to end — including a green,
authenticated cluster connect — without a cloud identity provider:

```bash
make oidc-dev        # bring the stack up
make oidc-dev-stop   # tear it all down
```

## What `make oidc-dev` does

1. Generates a dev CA + TLS cert (`.dev/oidc/certs/`, gitignored).
2. Starts an HTTPS [Dex](https://dexidp.io/) provider in Docker (`kubeli-dex`,
   `https://host.minikube.internal:5556/dex`).
3. Adds `127.0.0.1 host.minikube.internal` to `/etc/hosts` (one line, **sudo**).
4. Starts a dedicated minikube profile `kubeli-oidc` whose apiserver is
   configured to trust Dex (`--oidc-issuer-url`, `--oidc-ca-file`, …) and binds
   the OIDC user to `cluster-admin`.
5. Repoints the profile's own `kubeli-oidc` context at an OIDC sign-in user, so
   Kubeli shows a single cluster that connects via OIDC (not the extra cert
   admin context that `minikube start` creates).

Then:

```bash
make build && open src-tauri/target/release/bundle/macos/Kubeli.app
```

In Kubeli, connect to **kubeli-oidc**. The browser opens Dex (accept the
dev-cert warning once); log in with **dev@kubeli.test / password**; the redirect
returns the token and the connect goes green.

> Need the cert admin back (e.g. if OIDC breaks)? `minikube update-context -p
> kubeli-oidc` restores the certificate-based `kubeli-oidc` context.

## Why it needs a build (the kubeli:// callback)

The OIDC redirect is `kubeli://oidc/callback`, a custom URL scheme the OS only
routes to an **installed/bundled** app — `make dev` generally won't receive it.
So test the full flow against a build.

## How the pieces trust each other

`kube-apiserver` only accepts an HTTPS OIDC issuer, and the issuer host must
resolve to Dex from both the host and the apiserver. We use
`host.minikube.internal`: the minikube node resolves it natively to the host
gateway, and the `/etc/hosts` line covers the host side. Three consumers trust
the generated dev CA:

- **apiserver** — via `--oidc-ca-file` (CA staged through `~/.minikube/files`).
- **Kubeli** — via `--certificate-authority` in the `oidc-login` exec args
  (Kubeli's OIDC client only trusts public roots otherwise).
- **browser** — you click past the warning once (or trust the CA in Keychain).

## Requirements

`docker`, `minikube`, `kubectl`, `openssl`, and `sudo` for the one `/etc/hosts`
line. Dev only — none of this is for production.
