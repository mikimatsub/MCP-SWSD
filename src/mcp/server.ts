import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const SERVER_NAME = 'swsd-mcp';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = [
  'Tools wrap the SolarWinds Service Desk (SWSD / Samanage) API.',
  'IDs are integers. List endpoints accept structured filters; do not pass raw query strings.',
  'For pagination, prefer narrowing filters over deep paging.',
  'For custom-field writes (custom_fields parameter on incident/solution write tools), call swsd_describe_custom_fields first — field names and types are tenant-specific.',
  'For requests mentioning "me", "my", or "I" (e.g. "my tickets", "tickets in my group"), call swsd_get_me first to learn the authenticated user\'s id, email, and group memberships. Then pass those to assignee_email/requester_email filters on swsd_list_incidents (or use swsd_list_my_incidents which does this in one call). Without this step, "my X" queries cannot be answered correctly.',
].join(' ');

export function createMcpServer(): McpServer {
  return new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: INSTRUCTIONS,
      capabilities: { tools: {}, logging: {} },
    },
  );
}
