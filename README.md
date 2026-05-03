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

**v0.1 — incident read MVP.** Implemented tools:

| Tool | Profiles | Description |
|---|---|---|
| `swsd_get_server_info` | all | Server name, version, profile, enabled tools, base URL host |
| `swsd_health_check` | all | Verify SWSD reachability and authentication with a minimal call |
| `swsd_list_incidents` | triage, agent, full | List incidents with structured filters and pagination (compact projection) |
| `swsd_get_incident` | triage, agent, full | Fetch one incident by ID, full passthrough including custom fields |

Write tools, comment tools, solution tools, lookup readers, and Copilot
Studio Swagger generation arrive in v0.2+.

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

---

## Profiles

Profiles are tool-name sets registered at server start. They cannot be changed
mid-session.

| Profile | Intent | v0.1 tool count |
|---|---|---|
| `triage` | Read-heavy support workflow | 4 |
| `agent` | Ticket-handler workflow (default) | 4 |
| `knowledge` | KB-author workflow (write tools land in v0.6) | 2 |
| `full` | Every non-destructive tool that has been validated | 4 |

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
3. **Docker image.** Same code; bundle for users who prefer container
   isolation. (Dockerfile arrives in v0.4.)

---

## Roadmap

- **v0.2** — write tools (`create_incident`, `update_incident`, `assign_incident`,
  `update_incident_state`), 422 contract tests
- **v0.3** — comment tools, triage profile finalized
- **v0.4** — Dockerfile, container image, health probes
- **v0.5** — Copilot Studio Swagger 2.0 generator (per profile)
- **v0.6** — solution / knowledge-base tools
- **v1.0** — npm publish, public release

---

## License

MIT — see [LICENSE](./LICENSE).
