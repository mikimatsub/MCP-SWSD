---
title: Tools reference
description: The 23 MCP tools swsd-mcp registers, organized by category and profile.
---

:::note[Migration in progress]
Per-tool reference (input schemas, examples, edge cases) is the next big content addition. For now, the README's Tools table is the canonical summary.
:::

→ **[Tools table in the README](https://github.com/mikimatsub/MCP-SWSD#tools-23-across-6-categories)**
→ **[Profiles overview](https://github.com/mikimatsub/MCP-SWSD#profiles)**

## Quick reference

23 tools across six categories:

- **Utility** (2): server info, health check
- **Incidents** (7): list, get, create, update, assign, state-transition, link-solution
- **Comments** (3): list, add, update
- **Solutions / KB** (4): search, get, create, update
- **Lookups** (6): categories, sites, departments, users, groups, roles
- **Custom fields** (1): describe

## Profiles

| Profile | Tools | When to use |
|---|---|---|
| `triage` | 8 | First-line support: read tickets, post comments, no reassign/close |
| `agent` | 21 | Default; full ticket-handler workflow + KB lookups + custom-field schema |
| `knowledge` | 11 | KB authors: full solution CRUD, incident reads for context |
| `full` | 23 | Every tool registered |

Each tool's input schema and description is auto-discovered by your MCP client at runtime — ask the agent "what swsd tools are available?" for the live list.
