---
title: Tools reference
description: All 23 MCP tools swsd-mcp registers, organized by category with per-profile availability.
---

swsd-mcp registers **23 tools** across 6 categories. Each tool's input schema, full description, and output shape is auto-discovered by your MCP client at runtime — ask your agent _"what swsd tools are available?"_ for the live list.

This page is the at-a-glance summary: what each tool does and which [profile](/configuration/#profiles) includes it.

## Legend

| Symbol | Meaning |
|---|---|
| ✓ | Tool is registered in this profile |
| W | Write tool — modifies SWSD state. Does not retry on transient failure (avoids duplicate writes). |
| R | Read tool — safe to retry; auto-retries up to `SWSD_RETRY_MAX_ATTEMPTS` on 5xx/network errors. |

---

## Utility (2)

| Tool | Type | triage | agent | knowledge | full |
|---|---|---|---|---|---|
| `swsd_get_server_info` | R | ✓ | ✓ | ✓ | ✓ |
| `swsd_health_check` | R | ✓ | ✓ | ✓ | ✓ |

`swsd_get_server_info` returns version, profile, transport, base URL, and the list of enabled tools — useful for verifying server configuration from inside the MCP client.

`swsd_health_check` performs a live API call to SWSD (lightweight read against `/users/me.json`) and returns connectivity + auth status. Use this as the first call to confirm your token works.

---

## Incidents (7)

| Tool | Type | triage | agent | knowledge | full |
|---|---|---|---|---|---|
| `swsd_list_incidents` | R | ✓ | ✓ | ✓ | ✓ |
| `swsd_get_incident` | R | ✓ | ✓ | ✓ | ✓ |
| `swsd_create_incident` | W |   | ✓ |   | ✓ |
| `swsd_update_incident` | W |   | ✓ |   | ✓ |
| `swsd_assign_incident` | W |   | ✓ |   | ✓ |
| `swsd_update_incident_state` | W |   | ✓ |   | ✓ |
| `swsd_link_solution_to_incident` | W |   | ✓ |   | ✓ |

- **`swsd_list_incidents`** — paginated list with rich filtering (state, assignee, requester, site, priority, custom-field values). Returns id, name, state, requester, assignee, site, created/updated.
- **`swsd_get_incident`** — full incident detail including HTML and plain-text descriptions, custom-field values, comment thread, and linked solutions.
- **`swsd_create_incident`** — minimum required: `name`. Strongly recommended: `description`, `requester`, `category`, `site`. Returns the created incident's full payload. To set tenant-specific custom field values, pass `custom_fields: [{name, value}]` — call `swsd_describe_custom_fields` first to discover field names and (for Dropdowns) allowed values. Validated for Text, Dropdown, Number, Checkbox, and Date types.
- **`swsd_update_incident`** — partial-update semantics: pass only the fields you want to change. To clear a field, pass `null`. To set tenant-specific custom field values, pass `custom_fields: [{name, value}]` — call `swsd_describe_custom_fields` first to discover field names and (for Dropdowns) allowed values. Validated for Text, Dropdown, Number, Checkbox, and Date types.
- **`swsd_assign_incident`** — convenience wrapper for changing the assignee (user or group). Validates that the assignee exists.
- **`swsd_update_incident_state`** — state transition with optional resolution comment. Validates against your tenant's allowed states.
- **`swsd_link_solution_to_incident`** — append-only solution linking. Fetches existing links, adds the new one, PUTs the merged set so existing links aren't dropped.

---

## Comments (3)

| Tool | Type | triage | agent | knowledge | full |
|---|---|---|---|---|---|
| `swsd_list_incident_comments` | R | ✓ | ✓ |   | ✓ |
| `swsd_add_incident_comment` | W | ✓ | ✓ |   | ✓ |
| `swsd_update_comment` | W |   | ✓ |   | ✓ |

- **`swsd_list_incident_comments`** — paginated comment thread for an incident, including private/internal comments if your token has permission.
- **`swsd_add_incident_comment`** — post a new comment. Set `is_private: true` for internal-only comments (default `false` = visible to the requester). To edit later, use `swsd_update_comment`.
- **`swsd_update_comment`** — edit an existing comment's body or visibility.

---

## Solutions / Knowledge Base (4)

| Tool | Type | triage | agent | knowledge | full |
|---|---|---|---|---|---|
| `swsd_search_solutions` | R |   | ✓ | ✓ | ✓ |
| `swsd_get_solution` | R |   | ✓ | ✓ | ✓ |
| `swsd_create_solution` | W |   |   | ✓ | ✓ |
| `swsd_update_solution` | W |   |   | ✓ | ✓ |

- **`swsd_search_solutions`** — full-text search across titles and descriptions. Pass `category` to filter to a specific KB section.
- **`swsd_get_solution`** — full article including HTML and plain-text bodies, attachments, related incidents.
- **`swsd_create_solution`** — required: `title`. Strongly recommended: `description` (HTML supported), `state`, `category`. To set tenant-specific custom field values, pass `custom_fields: [{name, value}]` — call `swsd_describe_custom_fields` first to discover field names and (for Dropdowns) allowed values. Solutions require `name` keying (`custom_field_id` alone is rejected with HTTP 400). Validated for Text, Dropdown, Number, Checkbox, and Date types.
- **`swsd_update_solution`** — partial update. To replace the description entirely, pass the full new body. To set tenant-specific custom field values, pass `custom_fields: [{name, value}]` — call `swsd_describe_custom_fields` first to discover field names and (for Dropdowns) allowed values. Solutions require `name` keying (`custom_field_id` alone is rejected with HTTP 400). Validated for Text, Dropdown, Number, Checkbox, and Date types.

---

## Lookups (6)

All lookup tools are read-only. They exist to validate IDs/names before passing to write tools (e.g., look up a site name before creating an incident with `site_name`).

| Tool | Type | triage | agent | knowledge | full |
|---|---|---|---|---|---|
| `swsd_list_categories` | R | ✓ | ✓ | ✓ | ✓ |
| `swsd_list_sites` | R |   | ✓ |   | ✓ |
| `swsd_list_departments` | R |   | ✓ |   | ✓ |
| `swsd_list_users` | R | ✓ | ✓ | ✓ | ✓ |
| `swsd_list_groups` | R |   | ✓ |   | ✓ |
| `swsd_list_roles` | R |   | ✓ |   | ✓ |

Each returns `id`, `name`, plus type-specific fields (e.g., `time_zone` for sites, `disabled` for groups).

---

## Custom fields (1)

| Tool | Type | triage | agent | knowledge | full |
|---|---|---|---|---|---|
| `swsd_describe_custom_fields` | R |   | ✓ | ✓ | ✓ |

- **`swsd_describe_custom_fields`** — schema introspection for custom fields defined in your tenant. Returns each field's `name`, `type`, `category`, allowed values (for picklists), and which entity types it applies to.

:::note[v2: custom-field writes are now supported]
As of v2, the four write tools (`swsd_create_incident`, `swsd_update_incident`, `swsd_create_solution`, `swsd_update_solution`) accept a `custom_fields: [{name, value}]` parameter. Call `swsd_describe_custom_fields` first to discover field names and (for Dropdowns) allowed values. Validated for Text, Dropdown, Number, Checkbox, and Date types. Solutions require `name` keying (`custom_field_id` alone is rejected with HTTP 400).
:::

---

## Adding tools to a profile

Use `SWSD_ENABLE_EXTRAS` to add specific tools on top of the chosen profile. See [Configuration → Profiles](/configuration/#profiles).

Example: triage profile + KB read access:

```bash
SWSD_PROFILE=triage
SWSD_ENABLE_EXTRAS=swsd_search_solutions,swsd_get_solution
```
