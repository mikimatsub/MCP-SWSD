# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-05-07

The v2 release. Strictly additive over v1.0.1 — no existing tool's input or
output schema changed, no tool was removed, no breaking change in any wire
contract. The major-version bump is for scope (5 new tools, MCP Apps UI
capability, identity tools, audits, custom-field writes, and the Service
Catalog category) rather than for SemVer-compatibility breakage.

Highlights:

- **Identity** — `swsd_get_me` decodes the JWT, looks up the authenticated
  user via `/users/{id}.json`, and returns user_id + email + groups so
  agents can answer "my X" queries without manual entry. `swsd_list_my_incidents`
  is the Asana-style wrapper.
- **MCP Apps UI** — four read tools (`swsd_get_incident`, `swsd_get_solution`,
  `swsd_list_incidents`, `swsd_describe_custom_fields`) ship rich UI bundles
  for hosts that support [SEP-1865](https://modelcontextprotocol.io/specification/2025-11-25).
  Hosts without MCP Apps support are unaffected.
- **Service Catalog** — three new tools (`swsd_list_catalog_items`,
  `swsd_get_catalog_item`, `swsd_create_service_request`) so agents can
  fulfill requests through SWSD's catalog instead of always creating
  generic incidents.
- **Audits** — `swsd_get_record_audits` exposes the per-record change log.
- **Custom-field writes** — `swsd_create_incident`, `swsd_update_incident`,
  `swsd_create_solution`, `swsd_update_solution` accept a `custom_fields`
  parameter that maps to SWSD's nested-wrapper write convention.
- **Scope discriminator** — list tools now return `pagination.total_scope`
  (`filtered` / `tenant` / `unknown`) and `applied_filters` echo so agents
  can distinguish "narrowed to my filters" from "all tenant data".

### Added (Tier 2 — v2 Service Catalog support)

- Three new tools that surface SWSD's Service Catalog:
  - `swsd_list_catalog_items` — paginated browse of catalog items with
    `state`, `department`, `site`, and free-text `query` filters. Returns
    compact summaries (id, name, state, category/subcategory, request_count,
    updated_at, variable_count). Carries the same Plan B
    `applied_filters` echo + `pagination.total_scope` discriminator as
    `swsd_list_incidents`.
  - `swsd_get_catalog_item` — single-item lookup that exposes the full
    `variables` array (the request form schema). Each variable carries
    `id` (consume as `custom_field_id` when submitting), `name`, `kind`
    (`free_text` / `drop_down_menu` / `multi_select` / `date` / `user`),
    `field_type` (numeric SAManage code), `options` (newline-separated
    allowed values for dropdowns), `required`, and `helptext`.
  - `swsd_create_service_request` — submits a request via
    `POST /catalog_items/{id}/service_requests.json`. The endpoint
    auto-sets `is_service_request: true` and inherits the catalog item's
    category/subcategory. Variables are sent as
    `request_variables_attributes` (Rails-style nested-attributes shape
    discovered through live probe — the read-shape `request_variables`
    field name is silently dropped by SWSD on this endpoint). Requester
    defaults to the JWT-authenticated user; the tool resolves the user's
    email via `GET /users/{id}.json` because this endpoint rejects
    `requester: {id}` and requires `requester: {email}`.
- Server `instructions` augmented with catalog-first guidance: when the
  user asks to "request" something, agents should call
  `swsd_list_catalog_items` → `swsd_get_catalog_item` →
  `swsd_create_service_request`, falling back to `swsd_create_incident`
  only when no catalog item matches.
- Tool counts after Plan E: `triage` 12, `agent` 27 (default),
  `knowledge` 15, `full` 29 across 8 categories (added the
  Service Catalog category). Per-profile Swagger specs regenerated.
- e2e smoke test (`.research/v2/smoke-tests/mcp-e2e-smoke.mjs`) extended
  with Test 8 verifying catalog endpoint integration end-to-end.

**Not shipped (deferred to v2.5):** `swsd_list_my_service_requests`. The
SAManage REST API has no documented filter parameter that narrows the
`/incidents.json` collection to service-request rows. We probed 14
candidate filters (`is_service_request=true`, `sub_type=*`,
`request_type=*`, `incident_type=*`, etc.) and all were silently ignored
(returned the unfiltered set). A wrapper that paginated through tens of
thousands of incidents to find the few service-request rows would be a
bad tool. Will revisit once SWSD documents the correct filter mechanism
or exposes a top-level `/service_requests.json` collection (currently
404).

### Added (Tier 1 — v2 MCP Apps capability)

- MCP Apps support (SEP-1865, spec 2025-11-25) for `swsd_get_incident`,
  `swsd_get_solution`, `swsd_list_incidents`, and
  `swsd_describe_custom_fields`. Capable hosts render rich UI (single-record
  detail views, filterable/sortable tables, searchable explorers); text-only
  clients are unaffected — the `_meta.ui.resourceUri` advertisement is
  silently ignored and the tools return their normal text + structured
  output. UI bundles are single-file inlined HTML (`text/html;profile=mcp-app`)
  with no external network access. New build pipeline (Vite +
  vite-plugin-singlefile) emits the bundles under `dist/ui/`; the server
  registers them via `registerAppTool` / `registerAppResource` from
  `@modelcontextprotocol/ext-apps@^1.7.1`.

### Changed

- Migrated dependency-update automation from Dependabot to Renovate. The
  `renovate.json` extends `mikimatsub/.github:renovate-config` (a central
  config repo shared across mikimatsub's projects), which itself extends
  the upstream `config:best-practices` preset. Notable behavior changes:
  3-day minimum-release-age on npm packages (supply-chain attack defense),
  weekly lock-file maintenance, abandonment detection, and pinned-digest
  helpers for Docker and GitHub Actions.

### Added (Tier 1 — v2 identity & scope)

- New tool `swsd_get_me` — JWT-payload decode + `GET /users/{id}.json` + optional `GET /profile.json` enrichment. Returns the authenticated user's id, email, name, role, department, site, group_ids, and assignment status. **Call this first when the request mentions "me", "my", or "I"** — server INSTRUCTIONS now teach the model this pattern.
- New tool `swsd_list_my_incidents` — thin wrapper that internally calls `swsd_get_me` then `swsd_list_incidents` with `assignee_email = your email`. Same input shape as `swsd_list_incidents` minus the `assignee_email` parameter. Asana-style explicit-my-X pattern (Stream 4 research).
- `applied_filters` echo + `pagination.total_scope` discriminator (`filtered` | `tenant` | `unknown`) on `swsd_list_incidents` and `swsd_list_my_incidents` responses. Closes the brief's scope-ambiguity failure mode in-band: the model can now distinguish "25 of 87 matching your filters" from "25 of 56,800 tenant-wide" without guessing. **No comparable MCP server in the ecosystem ships this** as of May 2026 (Linear, GitHub, Atlassian, Asana, ServiceNow, Notion, Slack, Stripe — verified during v2 research).
- Server `INSTRUCTIONS` augmented with whoami-first guidance — model receives this in the MCP `initialize` response, mirroring GitHub's `serverInstructions` "Always call get_me first" pattern.
- New JWT decoder helper (`src/swsd/jwt.ts`) — extracts user_ic + any other JWT claims locally, no HTTP cost. Defensive parsing returns null on any malformed input.

### Tests (Tier 1 — v2 identity & scope)

- New `tests/unit/swsd/jwt.test.ts` — 8 edge cases (sample SWSD JWT, ESM extra claims, invalid base64, non-JSON payload, non-object payload, defensive null/undefined inputs).
- New `tests/unit/mappers/me.test.ts` — 8 edge cases on `toUserMeRecord` (full record projection, /profile.json enrichment, defensive null handling, non-numeric id rejection, group_ids filtering of non-numeric entries).

### Added (Tier 1 — v2 custom-field writes)

- `custom_fields` parameter on `swsd_create_incident`, `swsd_update_incident`, `swsd_create_solution`, and `swsd_update_solution`. Accepts `[{name, value}]` rows. Name-keyed for cross-entity portability (Solutions reject `custom_field_id`-only keying with HTTP 400; Incidents accept either). Validated field types: Text, Dropdown, Number, Checkbox, Date.

### Fixed / Retracted

- The v0.5 documented limitation that "SWSD returns 500 on every payload variant tested" for custom-field writes was **incorrect**. v1's investigation tested only the array-direct shape `{custom_fields_values: [{name, value}]}`. The actual shape SWSD requires is the SAManage-documented nested wrapper `{custom_fields_values: {custom_fields_value: [{name, value}]}}` — confirmed live against the live tenant on May 6, 2026 and against the official `SAManage/Samples` Ruby code (https://github.com/SAManage/Samples/blob/master/Sync%20Users/sync_users.rb). The `swsd_describe_custom_fields` tool description and the server-level INSTRUCTIONS string have been updated accordingly.

### Added (Tier 1 — v2 quick wins)

- `detail_level: 'short' | 'long'` parameter on `swsd_get_incident` and `swsd_get_solution`. Use `'long'` to fold SWSD's `?layout=long` extras (comments, attachments, audits, SLA data, tags, statistics, satisfaction, resolution for incidents; attachments, audits, tags, full statistics for solutions) into one call. Replaces the typical 2–3 round-trip pattern.
- New tool `swsd_get_record_audits` — wraps `GET /{type}/{id}/audits.json` for `incidents`, `problems`, `changes`, `releases`, `solutions`, `hardwares`, and `other_assets`. In the `agent` and `full` profiles. Lets the model answer "who changed this and when?" without parsing layout=long.
- Expanded `swsd_list_incidents` filters: `sites`, `departments`, `assigned_to_group`, `created_from`/`created_to`, `updated_to`, `state_is_not`, `sort_by`, `sort_order`, free-text `query`. All forward-only — no breaking changes.
- `outputSchema` declared on all 15 read tools — enables client-side response validation, particularly useful for Microsoft Copilot Studio response shape validation.
- `upstream_rate_limit` block added to `swsd_get_server_info` output. Documents SWSD's account-wide rate limits (1000 cpm Advanced / 1500 cpm Premier; signal: `429 + Retry-After` only — no `X-RateLimit-*` headers).
- New tool `swsd_get_record_audits` registered in `agent` and `full` profiles, raising tool count from 23 to 24 across 7 categories (added the Audits category).

### Changed (Tier 1 — v2 quick wins)

- `@modelcontextprotocol/sdk` floor relaxed from exact `1.29.0` to `^1.26.0`. Picks up `GHSA-345p-7cg4-v4c7` (cross-client response-leak) fix as defense-in-depth even though v1's per-request server construction was already safe.

### Tests (Tier 1 — v2 quick wins)

- New `tests/unit/mappers/audit.test.ts` — 8 edge-case tests for `toAuditSummary`.
- New `tests/unit/toolNames.test.ts` — 25 tests asserting every tool in `PROFILE_TOOLS` matches the SEP-986 name regex (`^[a-zA-Z][a-zA-Z0-9_-]{0,127}$`). Defense against future drift.

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

[Unreleased]: https://github.com/mikimatsub/MCP-SWSD/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/mikimatsub/MCP-SWSD/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/mikimatsub/MCP-SWSD/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mikimatsub/MCP-SWSD/releases/tag/v1.0.0
