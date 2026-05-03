import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function toolError(message: string, hint?: string): CallToolResult {
  const text = hint ? `${message}\n\nHint: ${hint}` : message;
  return {
    isError: true,
    content: [{ type: 'text', text }],
  };
}
