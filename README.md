# swsd-mcp

[![CI](https://github.com/mikimatsub/MCP-SWSD/actions/workflows/ci.yml/badge.svg)](https://github.com/mikimatsub/MCP-SWSD/actions/workflows/ci.yml)
[![Security](https://github.com/mikimatsub/MCP-SWSD/actions/workflows/security.yml/badge.svg)](https://github.com/mikimatsub/MCP-SWSD/actions/workflows/security.yml)
[![npm version](https://img.shields.io/npm/v/swsd-mcp.svg)](https://www.npmjs.com/package/swsd-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-io.github.mikimatsub%2Fswsd-blue)](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.mikimatsub/swsd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Provenance](https://img.shields.io/badge/Provenance-SLSA-blue.svg)](https://www.npmjs.com/package/swsd-mcp)

**MCP server for SolarWinds Service Desk (SWSD / Samanage).** Works with any [Model Context Protocol](https://modelcontextprotocol.io) client to read and modify SWSD tickets, comments, knowledge-base articles, and more, using each user's own SWSD API token. See the [client compatibility matrix](https://mcp-swsd.pages.dev/compatibility/) for the tested list.

📖 **Full docs:** [mcp-swsd.pages.dev](https://mcp-swsd.pages.dev)

The server holds **zero credentials at rest**. Tokens are forwarded per-request, never persisted, never logged, and only sent to the configured SWSD API host.

> **Not affiliated with SolarWinds.** SolarWinds, Samanage, and Service Desk are trademarks of SolarWinds Worldwide, LLC. This is an independent open-source project that wraps the publicly documented SWSD REST API; it is not endorsed or sponsored by SolarWinds.

---

## Quick start

You need:

- An MCP client installed — any MCP-compatible client works ([compatibility matrix](https://mcp-swsd.pages.dev/compatibility/))
- A SolarWinds Service Desk **admin token (JWT)** — generate one in the SWSD UI: **Setup → Users & Groups → Users** → click your user → **Actions** → **Generate JSON Web Token** (Service Desk administrator rights required)

### 1. Add the config

Every stdio-capable MCP client uses the same JSON shape. Add this under `mcpServers` in your client's config file:

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

Replace `your-jwt-here` with your token. EU tenants use `https://apieu.samanage.com` instead.

**To customize:** add any [configuration variable](https://mcp-swsd.pages.dev/configuration/) into the same `env` block. Common one is `SWSD_PROFILE` to switch from the default `agent` profile to `triage`, `knowledge`, or `full` — see the [Profiles](#profiles) section below for current tool counts. For example, add `"SWSD_PROFILE": "full"` alongside `SWSD_TOKEN` and `SWSD_BASE_URL`.

### 2. Drop it in the right file

| Client | Config file path |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code | `~/.claude.json` (or use the shortcut below) |
| Cursor | `~/.cursor/mcp.json` |
| Continue, Cline, other clients | check your client's docs — same JSON shape |

Create the file if it doesn't exist. Then restart your client.

**Claude Code shortcut** — skip editing the file by hand. This single line pastes verbatim into any shell (bash, zsh, PowerShell, cmd):

```bash
claude mcp add swsd --env SWSD_TOKEN="your-jwt-here" --env SWSD_BASE_URL="https://api.samanage.com" -- npx -y swsd-mcp
```

**Microsoft Copilot Studio** — different path (it can't spawn local processes, so it needs an HTTP-transport server). See [`copilot-studio/README.md`](./copilot-studio/README.md), including the [Azure Container Apps deployment recipe](./docs/deployment/azure-container-apps.md) for hosting.

### 3. Verify it works

In Claude (or any MCP client), ask:

> _"Use swsd to check if you can connect."_

The agent should call `swsd_health_check` and report success. If it does, you're set up.

Try a few more:

- _"Show me incident 60310"_ — id-keyed tools accept either the internal id (≥7 digits) or the human-facing number visible in the SWSD UI (≤6 digits).
- _"List incidents updated in the last 7 days"_ — `updated_within: "7d"` (also `"24h"`, `"1w"`, `"30d"`).
- _"What tickets are assigned to me?"_ — `swsd_list_my_incidents` calls `swsd_get_me` internally, so you don't have to spell out an email.

---

## Tools (35 across 10 categories)

| Category | Tools |
|---|---|
| **Utility** | `swsd_get_server_info`, `swsd_health_check`, `swsd_get_me` |
| **Incidents** | `swsd_list_incidents`, `swsd_list_my_incidents`, `swsd_get_incident`, `swsd_create_incident`, `swsd_update_incident`, `swsd_assign_incident`, `swsd_update_incident_state`, `swsd_link_solution_to_incident` |
| **Comments** | `swsd_list_incident_comments`, `swsd_add_incident_comment`, `swsd_update_comment` |
| **Tasks** | `swsd_list_incident_tasks`, `swsd_create_incident_task`, `swsd_update_task_state` |
| **Problems** | `swsd_list_problems`, `swsd_get_problem`, `swsd_create_problem` |
| **Solutions / KB** | `swsd_search_solutions`, `swsd_get_solution`, `swsd_create_solution`, `swsd_update_solution` |
| **Service Catalog** | `swsd_list_catalog_items`, `swsd_get_catalog_item`, `swsd_create_service_request` |
| **Lookups** | `swsd_list_categories`, `swsd_list_sites`, `swsd_list_departments`, `swsd_list_users`, `swsd_list_groups`, `swsd_list_roles` |
| **Custom fields** | `swsd_describe_custom_fields` |
| **Audits** | `swsd_get_record_audits` |

Each tool's input schema, description, and output shape is auto-discovered by your MCP client at runtime. Ask the agent "what swsd tools are available?" for the live list.

---

## Service Catalog tools

When the user asks to **request** something — new hardware, software access, an account, a file restore — prefer the catalog flow over `swsd_create_incident`. SWSD's catalog items carry pre-defined approval routing, request variables (form fields), category/subcategory defaults, and SLA targets that a free-form incident misses.

| Tool | Purpose |
|---|---|
| `swsd_list_catalog_items` | Browse what's offerable — find a catalog item that matches the user's request. Filter by `state`, `department`, `site`, or free-text `query`. Returns compact summaries with `request_count` and `variable_count`. |
| `swsd_get_catalog_item` | Inspect a single item, including its `variables` (the form schema). Each variable carries an `id`, `name`, `kind` (free_text / drop_down_menu / multi_select / date / user), `options` (newline-separated allowed values for dropdowns), and `helptext`. |
| `swsd_create_service_request` | Submit the request. Posts to `POST /catalog_items/{id}/service_requests.json`, which auto-sets `is_service_request: true` and inherits the catalog item's category/subcategory. Each `request_variables` entry maps a catalog variable's `id` (as `custom_field_id`) to a string `value`. |

The server `instructions` advertise this preference order so capable agents pick the catalog flow automatically when the user's intent matches.

---

## MCP Apps support

swsd-mcp ships interactive UI bundles for seven read tools using the [MCP Apps capability](https://modelcontextprotocol.io/specification/2025-11-25) (SEP-1865). When a host that supports MCP Apps calls one of these tools, it can render a rich UI alongside the structured response — single-record detail views, filterable/sortable tables, comment threads, audit timelines, searchable explorers, and submit-ready forms — instead of (or in addition to) plain text.

| Tool | Widget | UI |
|---|---|---|
| `swsd_get_incident` | `incident-detail` | Single-record detail view (description, due date, SLA, resolution, custom fields) |
| `swsd_get_solution` | `solution-detail` | Single-record detail view with sanitized HTML body |
| `swsd_list_incidents`, `swsd_list_my_incidents` | `incident-list` | Filterable, sortable table with overflow scroll |
| `swsd_list_incident_comments` | `comment-thread` | Vertical conversation with author chips, timestamps, public/private badges, sanitized HTML bodies |
| `swsd_get_record_audits` | `audit-timeline` | Vertical timeline grouped by day with action chips and field-level diffs |
| `swsd_get_catalog_item` | `catalog-item-form` | Renders catalog variables as a form; submits via `swsd_create_service_request` (calls back into the server through `app.callServerTool`) |
| `swsd_describe_custom_fields` | `custom-fields` | Searchable explorer with scope/module filters |

The UI bundles are inlined HTML resources (`text/html;profile=mcp-app`) that read the tool's `structuredContent` from the MCP Apps host bridge — no external network access, no third-party scripts. HTML content (solution bodies, incident descriptions, comment bodies, catalog helptext) is sanitized client-side via DOMPurify before insertion. Hosts without MCP Apps support are unaffected: the same tools continue to return their normal text + structured output, and the `_meta.ui.resourceUri` advertisement is silently ignored.

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
| `triage` | Read-heavy first-line support workflow + commenting | 14 |
| `agent` | Full ticket-handler workflow + KB lookups + custom-field introspection (default) | 33 |
| `knowledge` | KB-author workflow + incident reads + custom-field introspection | 15 |
| `full` | Every tool | 35 |

Use `SWSD_ENABLE_EXTRAS=swsd_foo,swsd_bar` to add specific tools on top of a profile.

---

## Hosting an HTTP server (advanced)

The Quick Start above already runs swsd-mcp on your own machine — your MCP client spawns it on demand via `npx`. **Most users stop there.**

Set up an HTTP-mode server only if you need one of these:

- **Microsoft Copilot Studio** integration — Copilot Studio can't spawn local processes, so it needs an HTTP endpoint. After deployment, import the per-profile Swagger spec from [`copilot-studio/README.md`](./copilot-studio/README.md).
- **One shared instance for a team** — one deploy, many users, each providing their own token per-request
- **Stricter network control** — private VNet, IP allowlist, custom domain, etc.

### Docker

bash / zsh / Git Bash:

```bash
docker run --rm -d \
  --name swsd-mcp \
  -p 3000:3000 \
  -e SWSD_TRANSPORT=http \
  -e SWSD_TRUST_PROXY=1 \
  -e SWSD_BASE_URL=https://api.samanage.com \
  ghcr.io/mikimatsub/mcp-swsd:latest
```

PowerShell (Windows):

```powershell
docker run --rm -d `
  --name swsd-mcp `
  -p 3000:3000 `
  -e SWSD_TRANSPORT=http `
  -e SWSD_TRUST_PROXY=1 `
  -e SWSD_BASE_URL=https://api.samanage.com `
  ghcr.io/mikimatsub/mcp-swsd:latest
```

Hit `http://localhost:3000/healthz` to verify. The `/mcp` endpoint accepts MCP requests with the user's token in the `Authorization: Bearer <token>` or `X-SWSD-Token: <token>` header (per-request, not server-side).

### Cloud deployment recipes

The Docker image runs anywhere — Azure, AWS, GCP, Render, Fly.io, your own VM. Concrete recipes:

- [**Azure Container Apps**](./docs/deployment/azure-container-apps.md) — recommended for Microsoft Copilot Studio integration. Scale-to-zero pricing (~$0–5/month for low traffic).

(More recipes coming. PRs welcome.)

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
