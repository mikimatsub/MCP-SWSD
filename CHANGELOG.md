# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Migrated dependency-update automation from Dependabot to Renovate. The
  `renovate.json` extends `mikimatsub/.github:renovate-config` (a central
  config repo shared across mikimatsub's projects), which itself extends
  the upstream `config:best-practices` preset. Notable behavior changes:
  3-day minimum-release-age on npm packages (supply-chain attack defense),
  weekly lock-file maintenance, abandonment detection, and pinned-digest
  helpers for Docker and GitHub Actions.

### Added (Tier 1 — v2 custom-field writes)

- `custom_fields` parameter on `swsd_create_incident`, `swsd_update_incident`, `swsd_create_solution`, and `swsd_update_solution`. Accepts `[{name, value}]` rows. Name-keyed for cross-entity portability (Solutions reject `custom_field_id`-only keying with HTTP 400; Incidents accept either). Validated field types: Text, Dropdown, Number, Checkbox, Date.

### Fixed / Retracted

- The v0.5 documented limitation that "SWSD returns 500 on every payload variant tested" for custom-field writes was **incorrect**. v1's investigation tested only the array-direct shape `{custom_fields_values: [{name, value}]}`. The actual shape SWSD requires is the SAManage-documented nested wrapper `{custom_fields_values: {custom_fields_value: [{name, value}]}}` — confirmed live against the live tenant on May 6, 2026 and against the official `SAManage/Samples` Ruby code (https://github.com/SAManage/Samples/blob/master/Sync%20Users/sync_users.rb). The `swsd_describe_custom_fields` tool description and the server-level INSTRUCTIONS string have been updated accordingly.

## [1.0.0] — _pending first publish_

### Initial public release

First public release on npm and GitHub. The pre-release work happened
across 11 commits on the `main` branch — full git history captures
the development trajectory.

#### Tools (23 total across 6 categories)

**Utility (2)** — `swsd_get_server_info`, `swsd_health_check`

**Incidents (7)** — `swsd_list_incidents`, `swsd_get_incident`,
`swsd_create_incident`, `swsd_update_incident`, `swsd_assign_incident`,
`swsd_update_incident_state`, `swsd_link_solution_to_incident`

**Comments (3)** — `swsd_list_incident_comments`,
`swsd_add_incident_comment`, `swsd_update_comment`

**Solutions / KB (4)** — `swsd_search_solutions`, `swsd_get_solution`,
`swsd_create_solution`, `swsd_update_solution`

**Lookups (6)** — `swsd_list_categories`, `swsd_list_sites`,
`swsd_list_departments`, `swsd_list_users`, `swsd_list_groups`,
`swsd_list_roles`

**Custom fields (1)** — `swsd_describe_custom_fields` (read-only;
writes deferred per documented investigation)

#### Profiles

* `triage` (9 tools) — first-line support workflow
* `agent` (21 tools, default) — full ticket-handler workflow
* `knowledge` (11 tools) — KB-author workflow
* `full` (23 tools) — every non-destructive validated tool

#### Architecture

* Dual transport: stdio (local agents) and Streamable HTTP (Copilot
  Studio + hosted)
* Zero credentials at rest — server never persists or logs tokens
* Stateless HTTP transport (per-request token)
* Origin validation, rate limiting (per token+IP), request timeout,
  trust-proxy configurable
* SWSD_BASE_URL hostname allowlist (`*.samanage.com`) — SSRF defense
* Defensive parsing for unknown SWSD response shapes
* 146 unit tests, all hermetic (no live API)

#### Distribution

* npm: `swsd-mcp` (public, free)
* Docker: `ghcr.io/mikimatsub/mcp-swsd:latest`
* MIT license

#### Build & supply chain

* GitHub Actions pinned to commit SHAs
* Dockerfile base image pinned by digest
* npm OIDC trusted publishing — no long-lived NPM_TOKEN
* SLSA build provenance attestations on every release
* Dependabot for npm, GitHub Actions, Docker base
* Branch protection on `main`

#### Documentation

* `README.md` — install, configuration, transports, distribution
* `CONTRIBUTING.md` — bug reports, PR review criteria, local dev
* `SECURITY.md` — vulnerability disclosure process (GitHub Security
  Advisories), threat model summary
* `docs/SECURITY-POSTURE.md` — comprehensive security posture write-up
  (controls, supply chain hardening, standards alignment, verification
  methods)
* `copilot-studio/README.md` — per-profile Swagger 2.0 connector specs
  with import procedure for Microsoft Copilot Studio

#### Empirically validated against live tenant

* All 23 tools exercised end-to-end (read + write smoke tests)
* SWSD API behavior findings documented in tool descriptions:
  - `?query=` is the canonical search parameter for solutions
  - `solution_ids` (write) vs `solutions` (read) shape divergence
  - `/custom_fields.json` ignores `per_page` (handled client-side)
  - Custom-field values cannot be written via SWSD API in tested
    payload variants — documented as known limitation

#### Known limitations

* Custom-field WRITES via incident/solution write tools are not
  supported (SWSD returns 500 on every payload variant tested).
  See `swsd_describe_custom_fields` description.
* Independent third-party security audit not commissioned.
* Source-code SAST (CodeQL) and Docker image scanning (Trivy) not
  yet enabled — `npm audit` covers npm CVEs.

---

## Pre-1.0 development history

Prior to v1.0, all work happened on `main` without published releases.
Detailed history available via `git log`.

* **2026-05-03** — `0.5.0`: link_solution_to_incident, update_comment;
  custom-field writes investigated and reverted (SWSD API limitation)
* **2026-05-03** — `0.4.0`: describe_custom_fields tool +
  dump:custom-fields script
* **2026-05-03** — `0.3.0`: solution / KB tools (search, get, create,
  update); 20 tools total
* **2026-05-03** — `0.2.0` (commit-tagged): incident writes, comments,
  lookup readers; 16 tools total
* **2026-05-03** — `0.1.0`: initial dual-transport foundation +
  incident reads (4 tools)

[Unreleased]: https://github.com/mikimatsub/MCP-SWSD/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mikimatsub/MCP-SWSD/releases/tag/v1.0.0
