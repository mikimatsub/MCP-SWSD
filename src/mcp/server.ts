import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const SERVER_NAME = 'swsd-mcp';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = [
  'Tools wrap the SolarWinds Service Desk (SWSD / Samanage) API.',
  'IDs are integers. List endpoints accept structured filters; do not pass raw query strings.',
  'For pagination, prefer narrowing filters over deep paging.',
  'When custom-field write tools become available, call swsd_describe_custom_fields first — field names and types are tenant-specific.',
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
