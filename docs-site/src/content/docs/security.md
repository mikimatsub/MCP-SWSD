---
title: Security
description: Threat model, supply-chain hardening, and how to report vulnerabilities.
---

## Vulnerability reporting

Use [GitHub Security Advisories](https://github.com/mikimatsub/MCP-SWSD/security/advisories/new) to report issues privately. **Do not** open a public issue.

→ **[SECURITY.md](https://github.com/mikimatsub/MCP-SWSD/blob/main/SECURITY.md)** — disclosure process, SLAs, scope

## Security posture

→ **[SECURITY-POSTURE.md](https://github.com/mikimatsub/MCP-SWSD/blob/main/docs/SECURITY-POSTURE.md)** — comprehensive write-up covering:

- Token handling (zero credentials at rest, hashed rate-limit keys)
- Network controls (Origin validation, trust-proxy, SSRF defense)
- Supply chain (OIDC publish, SLSA provenance, pinned action SHAs)
- Standards alignment (SLSA, NIST SSDF, OWASP ASVS)
- How to verify each claim independently

## Continuous scanning

Every push and PR runs three security workflows in parallel:

- **gitleaks** — secret scanning across diff (PR) or history (push)
- **CodeQL** — JavaScript/TypeScript SAST with the security-extended query pack
- **OSV-Scanner** — dependency CVE scan against Google's OSV database

A weekly scheduled run catches newly disclosed CVEs against unchanged dependencies.

[![Security](https://github.com/mikimatsub/MCP-SWSD/actions/workflows/security.yml/badge.svg)](https://github.com/mikimatsub/MCP-SWSD/actions/workflows/security.yml)
