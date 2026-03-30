# SSO JWT Authentication

## Status: Scaffolded, Blocked on Auth Team

The SSO JWT auth CLI is **built and compiles** but cannot be tested end-to-end until OTOY's auth team provides the SSO endpoint details.

---

## What Exists Today

### Two auth mechanisms

| Mechanism                    | Header                          | Works now? | Use for                                                                |
| ---------------------------- | ------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `OTOY_API_KEY` (static)      | `ai: {key}`                     | Yes        | Queue API (`que.otoy.studio`) — image-to-3d, all 1099 endpoints        |
| `OTOY_STUDIO_TOKEN` (static) | `Authorization: Bearer {token}` | Yes        | MCP Worker (`otoy-studio-mcp...workers.dev`) — 20 MCP tools            |
| SSO JWT (dynamic)            | TBD                             | No         | Will replace both static tokens with user-scoped, auto-refreshing JWTs |

### Auth package: `otoystudio-scripts-main/`

Standalone Node.js/TypeScript CLI + library. Location: `C:/otoyla/dev/otoystudio-scripts-main/otoystudio-scripts-main/`

**Built and working:**

- Queue API client (`src/queue/client.ts`) — `imageToMesh()`, `submitJob()`, `pollJob()`, `listEndpoints()`
- CLI: `image-to-3d`, `endpoints` — tested end-to-end with `OTOY_API_KEY`

**Built, awaiting SSO endpoints:**

- SSO login flow (`src/auth/login.ts`) — PKCE + localhost callback + token exchange
- Token refresh (`src/auth/refresh.ts`) — auto-refresh with 5-min buffer
- Credential storage (`src/auth/credentials.ts`) — `~/.otoy-studio/credentials.json`
- CLI: `login`, `logout`, `status`, `token`

---

## SSO Login Flow (implemented)

```
otoy-studio-auth login
  1. Generate PKCE code_verifier + code_challenge (S256)
  2. Generate random state parameter
  3. Start HTTP server on localhost:{random_port}
  4. Open browser to: {AUTHORIZE_URL}?response_type=code&client_id={CLIENT_ID}
       &redirect_uri=http://127.0.0.1:{port}/callback
       &scope=openid+profile+email
       &code_challenge={challenge}&code_challenge_method=S256
       &state={state}
  5. User authenticates on OTOY SSO page, clicks OK
  6. SSO redirects to localhost callback with ?code={auth_code}&state={state}
  7. POST {TOKEN_URL} with grant_type=authorization_code, code, code_verifier
  8. Receive: { access_token, refresh_token, id_token, expires_in }
  9. Extract user email from JWT payload (base64url decode)
  10. Store to ~/.otoy-studio/credentials.json (mode 0600)
  11. Shut down callback server
```

**Token command** for integration:

```bash
# Prints valid JWT to stdout, auto-refreshing if needed
otoy-studio-auth token

# Use in .env or shell profile:
export OTOY_STUDIO_TOKEN=$(otoy-studio-auth token)
export OTOY_API_KEY=$(otoy-studio-auth token)  # if JWT replaces API key too
```

---

## What the Auth Team Needs to Provide

All values have env-var overrides so the auth team can test without code changes.

| What               | Env var override         | Current placeholder                                         |
| ------------------ | ------------------------ | ----------------------------------------------------------- |
| **Authorize URL**  | `OTOY_SSO_AUTHORIZE_URL` | `https://auth.otoy.studio/oauth2/authorize`                 |
| **Token URL**      | `OTOY_SSO_TOKEN_URL`     | `https://auth.otoy.studio/oauth2/token`                     |
| **Client ID**      | `OTOY_SSO_CLIENT_ID`     | `otoy-studio-cli`                                           |
| **Scopes**         | `OTOY_SSO_SCOPES`        | `openid profile email`                                      |
| **OIDC discovery** | `OTOY_SSO_DISCOVERY_URL` | `https://auth.otoy.studio/.well-known/openid-configuration` |

### Questions for auth team

1. **Identity provider** — AWS Cognito? Custom OIDC? The "set the AWS one for a signed url to get back" comment suggests Cognito.
2. **Client ID** — Does a public OAuth client exist for CLI tools? Needs `response_type=code` + PKCE support + `http://127.0.0.1:*/callback` as allowed redirect.
3. **Refresh tokens** — Does the SSO issue them? Without refresh, users re-login every time the JWT expires.
4. **JWT header format** — Once we have a JWT, which header does `que.otoy.studio` accept? `ai: {jwt}`? `Authorization: Bearer {jwt}`? Both?
5. **Token audience** — Does the JWT need a specific `aud` claim to work with both the MCP worker and queue API?

---

## How to Test Once Endpoints Are Known

```bash
# Set the real values
export OTOY_SSO_AUTHORIZE_URL="https://real-sso.otoy.studio/oauth2/authorize"
export OTOY_SSO_TOKEN_URL="https://real-sso.otoy.studio/oauth2/token"
export OTOY_SSO_CLIENT_ID="actual-client-id"

# Build
cd otoystudio-scripts-main/otoystudio-scripts-main
npm run build

# Login
node dist/cli.js login
# → browser opens → authenticate → "Authenticated as user@example.com"

# Verify token
node dist/cli.js status
# → shows user, expiry, refresh token presence

# Use JWT with queue API
export OTOY_API_KEY=$(node dist/cli.js token)
node dist/cli.js image-to-3d "https://some-image-url" --output-dir ./test-output

# Use JWT with MCP
export OTOY_STUDIO_TOKEN=$(node dist/cli.js token)
# MCP tools should work via .mcp.json ${OTOY_STUDIO_TOKEN}
```

---

## File Inventory

```
otoystudio-scripts-main/otoystudio-scripts-main/
  src/
    auth/
      config.ts         SSO endpoints (env-var overridable placeholders)
      login.ts          PKCE login flow (browser → localhost → token exchange)
      refresh.ts        Auto-refresh with 5-min buffer
      credentials.ts    ~/.otoy-studio/credentials.json (read/write/clear)
      logout.ts         Clear credentials
    queue/
      client.ts         que.otoy.studio REST client (submit/poll/download)
      index.ts          Queue exports
    cli.ts              CLI: login|logout|status|token|image-to-3d|endpoints
    index.ts            Library exports (auth + queue)
  dist/                 Compiled JS (npm run build)
  package.json          Deps: open (browser launch), typescript
```
