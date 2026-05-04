---
title: Quick start
description: Install and configure swsd-mcp in any MCP client in under five minutes.
---

This guide gets swsd-mcp running locally in your MCP client (Claude Desktop, Claude Code, Cursor, Continue, Cline) using `npx`. For [Microsoft Copilot Studio](/deployment/#microsoft-copilot-studio), see the Deployment guide — Copilot Studio needs an HTTP-transport server, which is a different setup.

## What you need

- An MCP client installed (Claude Desktop, Claude Code, Cursor, Continue, Cline, or any other [Model Context Protocol](https://modelcontextprotocol.io) client)
- Node.js 20 or newer (for `npx`)
- A SolarWinds Service Desk **admin token** — see below

## Generate an SWSD admin token

In the SWSD web UI, navigate:

1. **Setup → Users & Groups → Users**
2. Click your user to open the detail page
3. Click **Actions → Generate JSON Web Token**
4. Copy the token (it's a long JWT string)

:::caution[Service Desk administrator rights required]
Only users with a Service Desk administrator license can generate tokens. If you don't have admin rights, your administrator needs to generate one for you. The token inherits *your* permissions — when your role changes, the token's permissions change with it.
:::

## Add the MCP config

Every stdio-capable MCP client uses the same JSON shape. Add this block under `mcpServers` in your client's config file:

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

Replace `your-jwt-here` with the token from the previous step. **EU tenants** use `https://apieu.samanage.com` instead.

:::tip[Customize behavior]
Any variable from the [Configuration](/configuration/) page goes into this same `env` block. The most common one to add is `SWSD_PROFILE` to switch from the default `agent` profile (21 tools) to `triage` (8), `knowledge` (11), or `full` (23):

```json
"env": {
  "SWSD_TOKEN": "your-jwt-here",
  "SWSD_BASE_URL": "https://api.samanage.com",
  "SWSD_PROFILE": "full"
}
```
:::

## Find the right config file

| Client | Config file path |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code | `~/.claude.json` (or use the [shortcut below](#claude-code-shortcut)) |
| Cursor | `~/.cursor/mcp.json` |
| Continue, Cline, other clients | check your client's docs — same JSON shape |

Create the file if it doesn't exist. Then **restart your client** so it picks up the new server.

## Claude Code shortcut

Skip editing the file manually:

```bash
claude mcp add swsd \
  --env SWSD_TOKEN="your-jwt-here" \
  --env SWSD_BASE_URL="https://api.samanage.com" \
  -- npx -y swsd-mcp
```

This writes the same config block as above to `~/.claude.json`.

## Verify it works

In your MCP client, ask the agent:

> _"Use swsd to check if you can connect."_

The agent should call the `swsd_health_check` tool and report success. Once you see that, you're set up.

If something doesn't work, see [Configuration](/configuration/) for the full env-var reference and common troubleshooting.

## What you can do now

Try asking the agent things like:

- _"List my recent open incidents."_ → calls `swsd_list_incidents`
- _"Show me incident 12345 with comments."_ → calls `swsd_get_incident` + `swsd_list_incident_comments`
- _"Search the knowledge base for 'VPN troubleshooting'."_ → calls `swsd_search_solutions`
- _"What custom fields are available on incidents?"_ → calls `swsd_describe_custom_fields`

The full tool catalog is in [Tools reference](/tools/).

## Next steps

- **Tighten the tool set** — see [Configuration](/configuration/#profiles) to switch from the default `agent` profile to `triage` (read-heavy) or `knowledge` (KB authoring)
- **Hosting for a team** — see [Deployment](/deployment/) for the HTTP-transport setup
- **Microsoft Copilot Studio integration** — see [Deployment → Microsoft Copilot Studio](/deployment/#microsoft-copilot-studio)
