# swsd-mcp

[![CI](https://github.com/mikimatsub/MCP-SWSD/actions/workflows/ci.yml/badge.svg)](https://github.com/mikimatsub/MCP-SWSD/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/swsd-mcp.svg)](https://www.npmjs.com/package/swsd-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Provenance](https://img.shields.io/badge/Provenance-SLSA-blue.svg)](https://www.npmjs.com/package/swsd-mcp)

**MCP server for SolarWinds Service Desk (SWSD / Samanage).** Lets AI assistants — Claude Desktop, Claude Code, Cursor, Continue, Microsoft Copilot Studio, and any other [Model Context Protocol](https://modelcontextprotocol.io) client — read and modify SWSD tickets, comments, knowledge-base articles, and more, using each user's own SWSD API token.

The server holds **zero credentials at rest**. Tokens are forwarded per-request, never persisted, never logged, and only sent to the configured SWSD API host.

> **Not affiliated with SolarWinds.** SolarWinds, Samanage, and Service Desk are trademarks of SolarWinds Worldwide, LLC. This is an independent open-source project that wraps the publicly documented SWSD REST API; it is not endorsed or sponsored by SolarWinds.

---

## Quick start

You need:

- An MCP client (Claude Desktop, Claude Code, Cursor, etc.) installed
- A SolarWinds Service Desk **admin token (JWT)** — generate one in the SWSD UI: **Setup → Users & Groups → Users** → click your user → **Actions** → **Generate JSON Web Token** (Service Desk administrator rights required)

Pick your MCP client below and paste the config block. Restart the client. You're done.

### Claude Desktop

Open your Claude Desktop config file:

| OS | Config file path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Add this under `mcpServers`:

```json
{
  "mcpServers": {
    "swsd": {
      "command": "npx",
      "args": ["-y", "swsd-mcp"],
      "env": {
        "SWSD_TOKEN": "your-jwt-here",
        "SWSD_BASE_URL": "https://api.samanage.com"
      }
    }
  }
}
```

Replace `your-jwt-here` with your token. For EU tenants, use `https://apieu.samanage.com`. Restart Claude Desktop.

### Claude Code

One command:

```bash
claude mcp add swsd \
  --env SWSD_TOKEN="your-jwt-here" \
  --env SWSD_BASE_URL="https://api.samanage.com" \
  -- npx -y swsd-mcp
```

Or edit `mcp.json` directly with the same JSON block as Claude Desktop above.

### Cursor

Open `~/.cursor/mcp.json` (create it if it doesn't exist) and paste:

```json
{
  "mcpServers": {
    "swsd": {
      "command": "npx",
      "args": ["-y", "swsd-mcp"],
      "env": {
        "SWSD_TOKEN": "your-jwt-here",
        "SWSD_BASE_URL": "https://api.samanage.com"
      }
    }
  }
}
```

Restart Cursor.

### Continue, Cline, and other MCP clients

Most MCP clients use the same JSON config shape — just different file paths. The pattern:

```json
{
  "mcpServers": {
    "swsd": {
      "command": "npx",
      "args": ["-y", "swsd-mcp"],
      "env": {
        "SWSD_TOKEN": "your-jwt-here",
        "SWSD_BASE_URL": "https://api.samanage.com"
      }
    }
  }
}
```

Check your client's docs for the config file location.

### Microsoft Copilot Studio

Copilot Studio requires an HTTP-transport MCP server (it can't spawn local processes). See [`copilot-studio/README.md`](./copilot-studio/README.md) for the full setup, including the [Azure Container Apps deployment recipe](./docs/deployment/azure-container-apps.md) for hosting the server.

### Verify it works

In Claude (or any MCP client), ask:

> _"Use swsd to check if you can connect."_

The agent should call `swsd_health_check` and report success. If it does, you're set up.

---

## Tools (23 across 6 categories)

| Category | Tools |
|---|---|
| **Utility** | `swsd_get_server_info`, `swsd_health_check` |
| **Incidents** | `swsd_list_incidents`, `swsd_get_incident`, `swsd_create_incident`, `swsd_update_incident`, `swsd_assign_incident`, `swsd_update_incident_state`, `swsd_link_solution_to_incident` |
| **Comments** | `swsd_list_incident_comments`, `swsd_add_incident_comment`, `swsd_update_comment` |
| **Solutions / KB** | `swsd_search_solutions`, `swsd_get_solution`, `swsd_create_solution`, `swsd_update_solution` |
| **Lookups** | `swsd_list_categories`, `swsd_list_sites`, `swsd_list_departments`, `swsd_list_users`, `swsd_list_groups`, `swsd_list_roles` |
| **Custom fields** | `swsd_describe_custom_fields` |

Each tool's input schema, description, and output shape is auto-discovered by your MCP client at runtime. Ask the agent "what swsd tools are available?" for the live list.

---

## Configuration

All settings via environment variables. Most users only need `SWSD_TOKEN` and `SWSD_BASE_URL`.

### Essential

| Variable | Default | Notes |
|---|---|---|
| `SWSD_TOKEN` | — | Required. Your SWSD admin token (JWT). |
| `SWSD_BASE_URL` | `https://api.samanage.com` | EU tenant: `https://apieu.samanage.com` |
| `SWSD_PROFILE` | `agent` | Tool set: `triage`, `agent`, `knowledge`, or `full` (see below) |

### Advanced (HTTP transport only)

| Variable | Default | Notes |
|---|---|---|
| `SWSD_TRANSPORT` | `stdio` | Set to `http` for hosted/Copilot Studio use |
| `PORT` | `3000` | HTTP listen port |
| `SWSD_TRUST_PROXY` | `false` | Set to `1` behind Azure App Service / Nginx; `2` behind Cloudflare |
| `SWSD_ALLOWED_ORIGINS` | — | Comma-separated. Empty = no Origin restriction (only safe behind a trusted proxy) |
| `SWSD_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window in ms |
| `SWSD_RATE_LIMIT_MAX` | `100` | Max requests per window per token+IP |

### Reliability

| Variable | Default | Notes |
|---|---|---|
| `SWSD_RETRY_MAX_ATTEMPTS` | `3` | Auto-retry attempts for 5xx and network errors on GETs |
| `SWSD_REQUEST_TIMEOUT_MS` | `30000` | Per-request timeout for outbound SWSD calls |

### Other

| Variable | Default | Notes |
|---|---|---|
| `SWSD_API_VERSION` | `v2.1` | Override only if your tenant requires v1.1 |
| `SWSD_ENABLE_EXTRAS` | — | Comma-separated extra tool names to enable beyond the profile |

See [`.env.example`](./.env.example) for the complete annotated list.

---

## Profiles

Profiles control which tools are registered at startup. Cannot be changed mid-session.

| Profile | Intent | Tool count |
|---|---|---|
| `triage` | Read-heavy first-line support workflow + commenting | 9 |
| `agent` | Full ticket-handler workflow + KB lookups + custom-field introspection (default) | 21 |
| `knowledge` | KB-author workflow + incident reads + custom-field introspection | 11 |
| `full` | Every tool | 23 |

Use `SWSD_ENABLE_EXTRAS=swsd_foo,swsd_bar` to add specific tools on top of a profile.

---

## Self-hosting

Most users use `npx` (the Quick Start above). Self-host when:

- You want to expose this to **Microsoft Copilot Studio** (requires HTTP transport)
- You want a **shared instance** for your team (one deploy, many users with their own tokens)
- You want **stricter network control** (private VNet, IP allowlist, etc.)

### Docker (HTTP transport)

```bash
docker run --rm -d \
  --name swsd-mcp \
  -p 3000:3000 \
  -e SWSD_TRANSPORT=http \
  -e SWSD_TRUST_PROXY=1 \
  -e SWSD_BASE_URL=https://api.samanage.com \
  ghcr.io/mikimatsub/mcp-swsd:latest
```

Hit `http://localhost:3000/healthz` to verify. The `/mcp` endpoint accepts MCP requests with the user's token in the `Authorization: Bearer <token>` or `X-SWSD-Token: <token>` header (per-request, not server-side).

### Cloud deployment recipes

The Docker image runs anywhere — Azure, AWS, GCP, Render, Fly.io, your own VM. Concrete recipes:

- [**Azure Container Apps**](./docs/deployment/azure-container-apps.md) — recommended for Microsoft Copilot Studio integration. Scale-to-zero pricing (~$0–5/month for low traffic).

(More recipes coming. PRs welcome.)

### Microsoft Copilot Studio integration

After deploying the HTTP server, you import a Swagger 2.0 connector spec into Copilot Studio. Per-profile Swagger files and the import procedure are in [`copilot-studio/README.md`](./copilot-studio/README.md).

---

## Documentation

- [`SECURITY.md`](./SECURITY.md) — vulnerability reporting via GitHub Security Advisories
- [`docs/SECURITY-POSTURE.md`](./docs/SECURITY-POSTURE.md) — security controls, supply-chain hardening, verification methods
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — bug reports, PR review criteria, local development setup
- [`CHANGELOG.md`](./CHANGELOG.md) — version history
- [`copilot-studio/`](./copilot-studio/) — Microsoft Copilot Studio Swagger connector specs and import guide
- [`docs/deployment/`](./docs/deployment/) — cloud deployment recipes

---

## License

MIT — see [LICENSE](./LICENSE). Provided "as is" without warranty.

## Trademarks

SolarWinds, Samanage, and Service Desk are trademarks of SolarWinds Worldwide, LLC. This project is not affiliated with, endorsed by, or sponsored by SolarWinds.
