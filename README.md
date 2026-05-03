# swsd-mcp

MCP server for SolarWinds Service Desk (SWSD / Samanage). Single binary, two
transports:

- **stdio** — for local agents (Claude Code, Claude Desktop, Cursor, etc.)
- **Streamable HTTP** — for hosted deployments and Microsoft Copilot Studio

The server holds zero credentials. Each user supplies their own SWSD API
token: through an environment variable for stdio, or per-request via the
`Authorization` / `X-SWSD-Token` header for HTTP.

---

## Status

**v0.3 — solution / KB tools added.** 20 tools across 5 categories:

| Tool | Profiles | Notes |
|---|---|---|
| `swsd_get_server_info` | all | Server metadata (local, no SWSD call) |
| `swsd_health_check` | all | Verify SWSD reachability + auth |
| **Incidents** | | |
| `swsd_list_incidents` | triage, agent, knowledge, full | Compact projection, structured filters, pagination |
| `swsd_get_incident` | triage, agent, knowledge, full | Full passthrough including custom fields |
| `swsd_create_incident` | agent, full | WRITE — creates new incident |
| `swsd_update_incident` | agent, full | WRITE — partial field update |
| `swsd_assign_incident` | agent, full | WRITE — safe assignment wrapper |
| `swsd_update_incident_state` | agent, full | WRITE — safe state-transition wrapper |
| **Comments** | | |
| `swsd_list_incident_comments` | triage, agent, full | Read incident discussion thread |
| `swsd_add_incident_comment` | triage, agent, full | WRITE — public or private |
| **Solutions (KB)** | | |
| `swsd_search_solutions` | agent, knowledge, full | Free-text search via canonical `?query=` param |
| `swsd_get_solution` | agent, knowledge, full | Full passthrough including HTML and plain-text descriptions |
| `swsd_create_solution` | knowledge, full | WRITE — new KB article |
| `swsd_update_solution` | knowledge, full | WRITE — partial field update |
| **Lookups** | | |
| `swsd_list_categories` | triage, agent, knowledge, full | Hierarchical categories with parent/children |
| `swsd_list_sites` | agent, full | Office/branch locations |
| `swsd_list_departments` | agent, full | Org divisions |
| `swsd_list_users` | triage, agent, knowledge, full | With `available_for_assignment` filter |
| `swsd_list_groups` | agent, full | Assignment teams |
| `swsd_list_roles` | agent, full | Permission profiles |

Custom-field introspection (`swsd_describe_custom_fields`) and the tenant
schema fixture script arrive in v0.4.

---

## Quick start

### Prerequisites

- **Node.js 24 LTS (Krypton)** — `node --version` should report `v24.x`. Earlier
  releases are not supported (Node 20 reached EOL on 2026-04-30).
- A SolarWinds Service Desk API token. Generate one in the SWSD UI:
  Setup → Account → API Token.

### Install

```bash
npm install
npm run build
```

### Run a smoke test (stdio)

```bash
export SWSD_TOKEN="your-jwt-here"
export SWSD_BASE_URL="https://api.samanage.com"   # or apieu.samanage.com for EU

# Run the MCP Inspector against the built stdio binary
npm run inspect:stdio
```

The Inspector UI opens at `http://localhost:6274`. Click **List Tools** —
you should see four `swsd_*` tools. Try `swsd_health_check` first.

### Run unit tests

```bash
npm test
```

### Run as an HTTP server

```bash
export SWSD_TRANSPORT=http
export PORT=3000
export SWSD_ALLOWED_ORIGINS="https://your-client.example.com"
npm start
```

The server listens on `POST /mcp` (MCP traffic) and `GET /healthz` (health
probes). Token comes per-request from `Authorization: Bearer <token>` or
`X-SWSD-Token: <token>`.

---

## Configuration

All settings can be passed via environment variables. See `.env.example` for
the complete annotated list.

| Variable | Default | Notes |
|---|---|---|
| `SWSD_TOKEN` | — | Required for stdio. Ignored in http (per-request). |
| `SWSD_BASE_URL` | `https://api.samanage.com` | EU tenant: `https://apieu.samanage.com`. |
| `SWSD_API_VERSION` | `v2.1` | Override only if your tenant needs v1.1. |
| `SWSD_TRANSPORT` | `stdio` | `stdio` or `http`. CLI flag `--transport=` overrides. |
| `SWSD_PROFILE` | `agent` | `triage`, `agent`, `knowledge`, or `full`. |
| `SWSD_ENABLE_EXTRAS` | — | Comma-separated extra tools to register beyond the profile. |
| `PORT` | `3000` | http transport only. |
| `SWSD_ALLOWED_ORIGINS` | — | Comma-separated. Empty = no Origin check (only when behind a trusted proxy). |
| `SWSD_RETRY_MAX_ATTEMPTS` | `3` | Retries for 5xx and network errors on GETs. |
| `SWSD_REQUEST_TIMEOUT_MS` | `30000` | Per-request timeout for outbound SWSD calls (1s-5min). Aborted requests are retried for GET/HEAD. |
| `SWSD_TRUST_PROXY` | `false` | Express trust-proxy. Set to `1` behind Azure App Service / Nginx; `2` behind Cloudflare → App Service. |
| `SWSD_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window for `/mcp`. |
| `SWSD_RATE_LIMIT_MAX` | `100` | Max requests per window per `sha256(token+IP)` key. `/healthz` is exempt. |

---

## Profiles

Profiles are tool-name sets registered at server start. They cannot be changed
mid-session.

| Profile | Intent | v0.3 tool count |
|---|---|---|
| `triage` | Read-heavy first-line support workflow + commenting | 9 |
| `agent` | Full ticket-handler workflow + KB lookups (default) | 18 |
| `knowledge` | KB-author workflow + incident reads for context | 10 |
| `full` | Every non-destructive tool that has been validated | 20 |

Use `SWSD_ENABLE_EXTRAS=swsd_foo,swsd_bar` to add specific tools on top of a
profile. Unknown tool names cause a startup error.

---

## Transports

### stdio

The default. The MCP host (Claude Code, Claude Desktop, etc.) spawns the
`swsd-mcp` process and communicates via stdin/stdout pipes. The token comes
from the `SWSD_TOKEN` environment variable.

Example `mcp.json` entry:

```json
{
  "mcpServers": {
    "swsd": {
      "command": "node",
      "args": ["/abs/path/to/dist/cli.js", "--transport=stdio"],
      "env": {
        "SWSD_TOKEN": "your-jwt-here",
        "SWSD_BASE_URL": "https://api.samanage.com"
      }
    }
  }
}
```

### Streamable HTTP

Single endpoint at `POST /mcp`. Stateless mode: each request creates a fresh
MCP server instance with the request's token bound to it. No session state is
tracked server-side.

For **Microsoft Copilot Studio**, see [`copilot-studio/README.md`](./copilot-studio/README.md)
for the per-profile Swagger 2.0 connector specs and import procedure.

### Docker (HTTP transport)

A multi-stage `Dockerfile` ships in the repo. Image is ~256 MB, runs as the
non-root `node` user, defaults to `SWSD_TRANSPORT=http` on port `3000`, and
exposes a `HEALTHCHECK` against `/healthz`.

```bash
# Build
docker build -t swsd-mcp:local .

# Run (HTTP transport)
docker run --rm -d --name swsd-mcp -p 3000:3000 \
  -e SWSD_BASE_URL=https://api.samanage.com \
  -e SWSD_PROFILE=agent \
  swsd-mcp:local

# Probe
curl http://localhost:3000/healthz
```

Token comes per-request from `Authorization` / `X-SWSD-Token` headers, same
as the un-containerized HTTP transport — never bake it into the image.

Example `mcp.json` entry (after deploying the server somewhere):

```json
{
  "mcpServers": {
    "swsd": {
      "url": "https://swsd-mcp.your-org.example.com/mcp",
      "type": "http",
      "headers": {
        "Authorization": "Bearer your-jwt-here"
      }
    }
  }
}
```

Health probes hit `GET /healthz` (does not require a SWSD token).

---

## Distribution

Three options for getting this in front of users:

1. **Self-host the HTTP transport.** Coworkers paste a URL + their token into
   `mcp.json`. Required for Copilot Studio (which only consumes Streamable
   HTTP). Server holds no credentials.
2. **Publish to npm; users run via `npx`.** Works for stdio. `npm install -g
   swsd-mcp` or rely on `npx -y swsd-mcp` invocation in `mcp.json`.
3. **Docker image via GHCR.** CI publishes a private image to
   `ghcr.io/mikimatsub/mcp-swsd:latest` (and `:sha-<short>` per commit) on
   every push to main. Visibility inherits the (currently private) repo.
   Teammates with repo access can pull after authenticating:

   ```bash
   # One-time: create a GitHub PAT with read:packages scope
   echo $GHCR_PAT | docker login ghcr.io -u <github-username> --password-stdin

   docker pull ghcr.io/mikimatsub/mcp-swsd:latest
   ```

   Deploy to App Service / Container Apps / Cloud Run / Kubernetes / a
   plain VM — the image is environment-agnostic.

---

## Roadmap

- **Done** — v0.1 incident read MVP (4 tools)
- **Done** — v0.2 incident writes, comments, lookups (16 tools)
- **Done** — Dockerfile + GitHub Actions CI (lint / typecheck / test / docker build + smoke on every push)
- **Done** — Copilot Studio Swagger 2.0 generator (per-profile connector specs in `copilot-studio/`)
- **Done** — v0.3 solution / KB tools (search, get, create, update — 20 tools total)
- **v0.4 (next)** — `swsd_describe_custom_fields` + tenant schema fixture script
- **v1.0** — npm publish, public release

---

## License

MIT — see [LICENSE](./LICENSE).
