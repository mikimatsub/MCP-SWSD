---
title: Configuration
description: Environment variables, profiles, and tool selection for swsd-mcp.
---

All configuration is via environment variables. Most users only need to set `SWSD_TOKEN` and `SWSD_BASE_URL` — see [Quick start](/quickstart/). This page is the full reference.

## Essential

| Variable | Default | Notes |
|---|---|---|
| `SWSD_TOKEN` | _(required for stdio)_ | Your SWSD admin token (JWT). For HTTP transport, pass per-request via the `Authorization` or `X-SWSD-Token` header instead. |
| `SWSD_BASE_URL` | `https://api.samanage.com` | EU tenant: `https://apieu.samanage.com`. SSRF defense: must be on the `samanage.com` domain — other URLs are rejected at startup. |
| `SWSD_PROFILE` | `agent` | Tool set: `triage`, `agent`, `knowledge`, or `full`. See [Profiles](#profiles) below. |

## Advanced (HTTP transport only)

These only apply when `SWSD_TRANSPORT=http`. They have no effect in stdio mode.

| Variable | Default | Notes |
|---|---|---|
| `SWSD_TRANSPORT` | `stdio` | Set to `http` for hosted/Copilot Studio deployments |
| `PORT` | `3000` | HTTP listen port |
| `SWSD_TRUST_PROXY` | `false` | Set to `1` behind Azure App Service / Nginx; `2` behind Cloudflare → App Service. Required for accurate `req.ip` (rate limiting depends on it). |
| `SWSD_ALLOWED_ORIGINS` | _(empty)_ | Comma-separated. Empty = no Origin restriction (only safe behind a trusted proxy that filters); set explicitly otherwise to mitigate DNS rebinding. |
| `SWSD_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window in milliseconds |
| `SWSD_RATE_LIMIT_MAX` | `100` | Max requests per window per `(token, IP)` pair (token is sha256-hashed for memory safety) |

## Reliability

| Variable | Default | Notes |
|---|---|---|
| `SWSD_RETRY_MAX_ATTEMPTS` | `3` | Auto-retry attempts for 5xx and network errors on read-only requests. Writes are never retried (would risk duplicate side effects). |
| `SWSD_REQUEST_TIMEOUT_MS` | `30000` | Per-request timeout for outbound SWSD calls. Hung connections waste worker resources; this caps the wait. |

## Other

| Variable | Default | Notes |
|---|---|---|
| `SWSD_API_VERSION` | `v2.1` | Override only if your tenant requires v1.1 (rare) |
| `SWSD_ENABLE_EXTRAS` | _(empty)_ | Comma-separated extra tool names to enable on top of the profile. Unknown names cause a startup error (loud-fail by design). |

The complete annotated example is in [`.env.example`](https://github.com/mikimatsub/MCP-SWSD/blob/main/.env.example) on GitHub.

## Profiles

Profiles control which tools are registered at startup. The choice is made once at startup and **cannot be changed mid-session** — restart the server to switch.

| Profile | Intent | Tool count |
|---|---|---|
| `triage` | Read-heavy first-line support workflow + commenting | 8 |
| `agent` | Full ticket-handler workflow + KB lookups + custom-field introspection (default) | 21 |
| `knowledge` | KB-author workflow + incident reads + custom-field introspection | 11 |
| `full` | Every tool registered | 23 |

### When to pick which

- **`triage`** — first-line support agents who read tickets and post comments but don't reassign or close. Minimal write surface.
- **`agent`** (default) — full incident-handling: create, update, assign, state-transition, link solutions, plus comment writes and KB lookups. The most common choice.
- **`knowledge`** — KB authors who need full solution CRUD plus incident reads for context. No incident writes.
- **`full`** — every tool. Use for hosted deployments serving multiple roles, or when you want to start permissive and tighten later.

### Adding individual tools to a profile

Use `SWSD_ENABLE_EXTRAS` to add specific tools on top of the chosen profile:

```bash
SWSD_PROFILE=triage
SWSD_ENABLE_EXTRAS=swsd_search_solutions,swsd_get_solution
```

This gives you the `triage` profile **plus** solution lookups — handy when first-line support needs to reference KB articles. Unknown tool names cause a startup error so typos don't silently expand or contract the registered set.

## Verifying configuration at startup

In stdio mode, the server prints a single line at startup with the active configuration:

```
swsd-mcp 1.0.1 — profile=agent, transport=stdio, baseUrl=https://api.samanage.com, tools=21
```

In HTTP mode, hit `/healthz` for `{"ok":true}` (deliberately minimal — no version disclosure to anonymous callers) or call the `swsd_get_server_info` MCP tool through your authenticated client for full configuration details.
