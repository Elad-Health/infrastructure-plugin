#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { loadConfig } from './config.js';
import { MssqlClient } from './mssqlClient.js';
import {
  connectionTools,
  queryTools,
  performanceTools,
  healthTools,
  jobTools,
  availabilityTools,
  schemaTools,
} from './tools/index.js';

// Combine all tools
const allTools = {
  ...connectionTools,
  ...queryTools,
  ...performanceTools,
  ...healthTools,
  ...jobTools,
  ...availabilityTools,
  ...schemaTools,
};

type ToolName = keyof typeof allTools;

// Initialize config and client
const config = loadConfig();
const client = new MssqlClient(config);

// Create MCP server
const server = new Server(
  {
    name: 'mssql-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Object.entries(allTools).map(([name, tool]) => {
    const fullSchema = zodToJsonSchema(tool.inputSchema, {
      $refStrategy: 'none',
    }) as Record<string, unknown>;
    const { $schema, ...inputSchema } = fullSchema;

    return {
      name,
      description: tool.description,
      inputSchema,
    };
  });

  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name as ToolName;
  const tool = allTools[toolName];

  if (!tool) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `Unknown tool: ${toolName}` }, null, 2),
        },
      ],
      isError: true,
    };
  }

  // Validate input using safeParse
  const parseResult = tool.inputSchema.safeParse(request.params.arguments || {});
  if (!parseResult.success) {
    const errors = parseResult.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('\n');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `Validation error:\n${errors}` }, null, 2),
        },
      ],
      isError: true,
    };
  }

  try {
    // Execute tool handler
    const result = await tool.handler(client, parseResult.data as never);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Graceful shutdown handler
async function shutdown() {
  console.error('Shutting down MSSQL MCP server...');
  await client.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MSSQL MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
