#!/usr/bin/env node
/**
 * Generate Copilot Studio connector Swagger 2.0 files for each SWSD MCP
 * profile. Output goes to `copilot-studio/<profile>.swagger.yaml`.
 *
 * Re-run after changing PROFILES or the template:
 *   npm run generate:swagger
 *
 * The committed .yaml files are the source of truth users grab — this
 * script just keeps them in sync with profile changes.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO_ROOT, 'copilot-studio');

interface PackageJson {
  version: string;
}

const pkg = JSON.parse(
  readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'),
) as PackageJson;

interface ProfileMeta {
  description: string;
  toolCount: number;
}

const PROFILES: Record<string, ProfileMeta> = {
  triage: {
    description:
      'Read-heavy first-line support workflow including incident lookup, ' +
      'comment reading, comment posting, and category/user lookups.',
    toolCount: 9,
  },
  agent: {
    description:
      'Full ticket-handler workflow: incident reads, writes (create / update / ' +
      'assign / state-transition / link-solution), comment reads and writes ' +
      '(public, private, edit), all six lookup tools (categories, sites, ' +
      'departments, users, groups, roles), solution reads (search + get) for KB ' +
      'lookups while triaging, plus custom-field schema introspection.',
    toolCount: 21,
  },
  knowledge: {
    description:
      'KB-author workflow: incident reads (for context), category/user lookups, ' +
      'full solution CRUD (search, get, create, update), and custom-field schema ' +
      'introspection.',
    toolCount: 11,
  },
  full: {
    description:
      'Every non-destructive tool that has been validated against the live SWSD ' +
      'tenant. Includes incident CRUD + solution-linking, comment CRU (create/' +
      'read/update), all lookups, solution CRUD, and custom-field schema ' +
      'introspection.',
    toolCount: 23,
  },
};

const PLACEHOLDER_HOST = 'REPLACE_WITH_YOUR_HOST.example.com';

function buildSwagger(profile: string, meta: ProfileMeta): string {
  return `swagger: '2.0'
info:
  title: SWSD MCP — ${profile} profile
  description: |
    SolarWinds Service Desk MCP server, ${profile} profile (${String(meta.toolCount)} tools).

    ${meta.description}

    Tools are discovered at runtime via MCP \`tools/list\` after the
    Copilot connector establishes a session. This Swagger only declares
    the transport endpoint and authentication; it does not enumerate
    individual tools.
  version: ${pkg.version}
host: ${PLACEHOLDER_HOST}
basePath: /
schemes:
  - https
consumes:
  - application/json
produces:
  - application/json
paths:
  /mcp:
    post:
      summary: SWSD MCP endpoint (Streamable HTTP)
      description: |
        Streamable HTTP MCP transport. Copilot Studio sends MCP JSON-RPC
        messages here. The MCP \`initialize\` handshake happens first, then
        \`tools/list\` to discover available tools, then \`tools/call\` for
        each tool invocation.
      operationId: InvokeMCP
      x-ms-agentic-protocol: mcp-streamable-1.0
      parameters:
        - in: body
          name: body
          required: true
          schema:
            type: object
      responses:
        '200':
          description: MCP JSON-RPC response
          schema:
            type: object
        '400':
          description: Unsupported MCP-Protocol-Version header
        '401':
          description: Missing or invalid SWSD token
        '403':
          description: Origin not in SWSD_ALLOWED_ORIGINS
securityDefinitions:
  swsd_token:
    type: apiKey
    in: header
    name: X-SWSD-Token
    description: |
      Your SolarWinds Service Desk API token (JWT). Generate one in the
      SWSD UI: Setup → Account → API Token. The MCP server forwards this
      to SWSD as \`X-Samanage-Authorization: Bearer <token>\` and never
      persists it.
security:
  - swsd_token: []
`;
}

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const [profile, meta] of Object.entries(PROFILES)) {
  const yaml = buildSwagger(profile, meta);
  const path = join(OUT_DIR, `${profile}.swagger.yaml`);
  writeFileSync(path, yaml, 'utf-8');
  process.stdout.write(`Wrote ${path}\n`);
  count++;
}

process.stdout.write(`\nGenerated ${String(count)} Swagger files.\n`);
process.stdout.write(
  `\nNEXT: edit each file's "host:" line to point at your deployed MCP\n` +
    `server, then import into Copilot Studio. See copilot-studio/README.md\n` +
    `for the full import procedure.\n`,
);
