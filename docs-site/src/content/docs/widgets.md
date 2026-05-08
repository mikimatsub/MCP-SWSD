---
title: Widgets reference
description: The seven MCP Apps UI bundles swsd-mcp ships, what they render, and which hosts support them.
---

swsd-mcp ships **seven** interactive UI bundles using the [MCP Apps capability](https://modelcontextprotocol.io/specification/2025-11-25) (SEP-1865). Each one is a single-file HTML resource served at `ui://swsd-mcp/<widget-name>` with content type `text/html;profile=mcp-app`. When a tool with an attached widget is called from an MCP Apps-capable host, the host renders the bundle alongside (or in place of) the structured-content text response. Hosts without MCP Apps support are unaffected — the same tools still return their normal text + structured output, and the `_meta.ui.resourceUri` advertisement is silently ignored.

All widgets are self-contained. No external network access, no third-party scripts. HTML coming from SWSD (solution bodies, incident descriptions, comment bodies, catalog helptext) is sanitized client-side via [DOMPurify](https://github.com/cure53/DOMPurify) before insertion. Theme variables and host fonts are applied via the SDK's `applyHostStyleVariables` / `applyDocumentTheme` / `applyHostFonts` helpers, so widgets follow the host's light/dark mode and font settings automatically.

## Widget catalog

| Widget | Tool(s) | What it renders |
|---|---|---|
| [`incident-detail`](#incident-detail) | `swsd_get_incident` | Single-incident card with description, due date, SLA, resolution, custom fields. |
| [`solution-detail`](#solution-detail) | `swsd_get_solution` | Single-solution card with full sanitized HTML body, attachments, audits, statistics. |
| [`incident-list`](#incident-list) | `swsd_list_incidents`, `swsd_list_my_incidents` | Sortable, filterable, scrollable table of incidents. |
| [`comment-thread`](#comment-thread) | `swsd_list_incident_comments` | Vertical comment thread with author chips, timestamps, public/private badges. |
| [`audit-timeline`](#audit-timeline) | `swsd_get_record_audits` | Vertical audit-log timeline grouped by day with action chips and field diffs. |
| [`catalog-item-form`](#catalog-item-form) | `swsd_get_catalog_item` | Renders catalog variables as a form; submits via `swsd_create_service_request`. |
| [`custom-fields`](#custom-fields) | `swsd_describe_custom_fields` | Searchable explorer with scope/module filters and per-field detail panel. |

## How widgets are loaded

```
1. Tool handler returns content + structuredContent + _meta.ui.resourceUri
2. Host fetches the resource via resources/read on resourceUri
3. Host opens the inlined HTML in a sandboxed iframe
4. Widget calls App.connect() — runs ui/initialize → ui/notifications/initialized
5. Server pushes the same structuredContent via ui/notifications/tool-result
6. Widget's toolresult listener renders the data
```

Steps 4–6 run over JSON-RPC postMessage between the host and the iframe. The widget never touches the network.

## Error handling

All seven widgets handle `isError: true` tool results: instead of an infinite "Loading…" spinner, they render a clear error state showing the tool's error message. This is the v2.1 fix for the v2.0 bug where tool errors silently spun forever.

## Per-widget detail

### `incident-detail`

Bound to `swsd_get_incident`. Card layout: header (id, name, state badge, priority chip), metadata grid (assignee, requester, category, site, department, created date, due date with **Overdue** chip when in the past), description (sanitized HTML), SLA section (response/resolve violations counts when present), resolution section (resolution body when set, only on resolved/closed incidents), and a custom fields table.

Pass `detail_level: "long"` to populate description, SLA, and resolution from `?layout=long`.

### `solution-detail`

Bound to `swsd_get_solution`. Card layout: header (id, name, state, category), metadata strip (author, created/updated dates, view count), and the **full** sanitized HTML body of the article — not an excerpt. This was the v2.1 fix for the v2.0 widget that only showed a teaser; the whole reason an agent opens a KB article is to read it.

### `incident-list`

Bound to both `swsd_list_incidents` and `swsd_list_my_incidents` (the latter auto-resolves the JWT user's email as `assignee_email`). Table columns: id, name, state, priority, assignee, updated_at. Sortable headers (click to toggle, ▲/▼ indicator + `aria-sort` on the active column). Wrapped in an `overflow-x: auto` container so the 6-column table scrolls instead of clipping at narrow viewports (<560px).

Pagination chip in the footer shows `page X of Y matching your filters` (when `pagination.total_scope === "filtered"`) or `page X of Y tenant-wide` (when `"tenant"`), driven by the v2 `applied_filters` echo + `total_scope` discriminator.

### `comment-thread`

Bound to `swsd_list_incident_comments`. Vertical list of comment cards. Each card has an author chip (avatar + name), timestamp, public/private badge, and the sanitized HTML body. Internal comments are visually distinguished with a left-border accent.

### `audit-timeline`

Bound to `swsd_get_record_audits`. Vertical timeline grouped by day. Each day section has a date header, then a list of audit cards: action chip (`Update`/`Create`/`Delete`), human-readable message (e.g. "State changed from New to Assigned"), the user who performed it, and the timestamp. Field-level diffs are rendered as `before → after` pairs when SWSD provides them.

### `catalog-item-form`

Bound to `swsd_get_catalog_item`. **The first widget that calls back into the server.** Renders the catalog item's `variables` as a form: `free_text` becomes `<input>`, `drop_down_menu` becomes `<select>` with the catalog's `options` as choices, `multi_select` becomes a multi-select, `date` becomes `<input type="date">`, `user` becomes a typeahead. Required variables are marked with an asterisk; helptext renders below the input.

The Submit button calls `app.callServerTool('swsd_create_service_request', {...})` with the form values mapped to the `request_variables` shape SWSD expects. Collapses the 4-round-trip workflow ("list catalog → get item → describe variables → submit") to 2 ("list catalog → get item + submit from widget").

### `custom-fields`

Bound to `swsd_describe_custom_fields`. Searchable explorer with a filter panel (scope: incident / solution / asset; module: text / dropdown / number / checkbox / date) and a results panel that shows each matching field's name, type, allowed values (for picklists), category, and which entity types it applies to. Useful for KB authors and agents who need to validate field names + dropdown values before passing them to `swsd_create_*` / `swsd_update_*` writes.

## Host compatibility

| Host | MCP Apps support | Notes |
|---|---|---|
| Claude Desktop | Yes | Renders widgets in-line in the conversation. |
| Claude Web (claude.ai) | Yes | Renders widgets in-line. |
| VS Code Insiders Copilot Chat | Yes | Spec-compliant. The v2.0.1 fix migrating to the SDK's `App` class made these and Claude Desktop work. |
| ChatGPT (Apps SDK) | Yes | OpenAI's MCP Apps client. |
| Goose | Yes | Block's MCP client. |
| Postman | Yes | Renders widgets when a request hits the MCP server. |
| MCPJam | Yes | Open-source MCP playground. |
| Claude Code CLI | Text-only | No widget rendering surface. Tools still return structured text. |
| LM Studio | Text-only | No widget rendering surface. |
| Microsoft Copilot Studio | Text-only | Connector layer is HTTP-only; widgets aren't rendered there. |

## See also

- [Tools reference](/tools/) — every tool, including which ones ship a widget
- [Architecture](/architecture/) — how the server, client, and SWSD API fit together
- [SEP-1865 (MCP Apps spec)](https://modelcontextprotocol.io/specification/2025-11-25) — the upstream protocol
