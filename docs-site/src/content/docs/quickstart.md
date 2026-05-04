---
title: Quick start
description: Install and configure swsd-mcp in any MCP client in under five minutes.
---

:::note[Migration in progress]
The full Quick Start currently lives in the project README. We're migrating the canonical content into this site over the next few releases — for now, the README is the source of truth.
:::

→ **[Quick start in the README](https://github.com/mikimatsub/MCP-SWSD#quick-start)**

The README walks through:

- Generating an SWSD admin token (Setup → Users & Groups → Users → Actions → Generate JSON Web Token)
- Adding the `mcpServers` config block to your client (Claude Desktop, Claude Code, Cursor, Continue, Cline)
- The `claude mcp add` shortcut for Claude Code users
- Verifying the connection with `swsd_health_check`

Microsoft Copilot Studio users — see [Deployment](/deployment/) for the HTTP transport setup, since Copilot Studio can't spawn local processes.
