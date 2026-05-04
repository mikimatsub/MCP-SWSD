---
title: Deployment
description: Self-host swsd-mcp via Docker, Azure Container Apps, or any container platform.
---

The Quick Start covers `npx`-based local stdio installs (one user, one machine). **Self-hosting** in HTTP-transport mode is required for two cases:

1. **Microsoft Copilot Studio integration** — Copilot Studio can't spawn local processes
2. **Shared team instance** — one deploy, many users, each providing their own token per request

## Recipes

→ **[Azure Container Apps walkthrough](https://github.com/mikimatsub/MCP-SWSD/blob/main/docs/deployment/azure-container-apps.md)** — recommended for Copilot Studio integration. Scale-to-zero pricing (~$0–5/month for low traffic).

→ **[Docker quick command](https://github.com/mikimatsub/MCP-SWSD#docker)** — runs anywhere; minimal config in the README.

→ **[Copilot Studio connector setup](https://github.com/mikimatsub/MCP-SWSD/tree/main/copilot-studio)** — per-profile Swagger 2.0 specs and import procedure.

:::note[More recipes coming]
GCP Cloud Run, AWS App Runner, and Fly.io recipes are on the roadmap. PRs welcome — see [CONTRIBUTING](/contributing/).
:::
