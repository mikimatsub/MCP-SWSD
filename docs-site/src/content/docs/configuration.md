---
title: Configuration
description: Environment variables and profile settings for swsd-mcp.
---

:::note[Migration in progress]
Full configuration reference lives in the project README and `.env.example`. Migration into this docs site is tracked for an upcoming PR.
:::

→ **[Configuration tables in the README](https://github.com/mikimatsub/MCP-SWSD#configuration)**
→ **[Annotated `.env.example`](https://github.com/mikimatsub/MCP-SWSD/blob/main/.env.example)**

Most users only need `SWSD_TOKEN` and `SWSD_BASE_URL`. The README documents the full set:

- **Essential** — token, base URL, profile selection
- **Advanced (HTTP transport only)** — port, trust-proxy, allowed origins, rate limiting
- **Reliability** — retry attempts, request timeout
- **Other** — API version pinning, extra-tool enablement
