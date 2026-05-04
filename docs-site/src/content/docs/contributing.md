---
title: Contributing
description: How to file issues, propose features, and submit pull requests for swsd-mcp.
---

→ **[CONTRIBUTING.md](https://github.com/mikimatsub/MCP-SWSD/blob/main/CONTRIBUTING.md)** — bug reports, PR review criteria, local development setup

→ **[CODE_OF_CONDUCT.md](https://github.com/mikimatsub/MCP-SWSD/blob/main/CODE_OF_CONDUCT.md)** — Contributor Covenant 3.0

## Quick links

- **[Open an issue](https://github.com/mikimatsub/MCP-SWSD/issues/new/choose)** — bug report or feature request templates
- **[Open a security advisory](https://github.com/mikimatsub/MCP-SWSD/security/advisories/new)** — for vulnerabilities
- **[Browse open PRs](https://github.com/mikimatsub/MCP-SWSD/pulls)**

## Local development

```bash
git clone https://github.com/mikimatsub/MCP-SWSD.git
cd MCP-SWSD
npm install
npm test
```

Pre-commit hooks (husky + lint-staged) run `eslint --fix` on staged TS/JS files automatically. Full CI runs lint, typecheck, tests, and Docker smoke before merge.

For docs-site changes, see [`docs-site/README.md`](https://github.com/mikimatsub/MCP-SWSD/blob/main/docs-site/README.md).
