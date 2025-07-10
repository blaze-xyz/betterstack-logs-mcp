#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from './config.js';
import { BetterstackClient } from './betterstack-client.js';
import { registerSourceManagementTools } from './tools/source-management.js';
import { registerQueryTools } from './tools/query-tools.js';
import { registerAnalysisTools } from './tools/analysis-tools.js';

// Load configuration
let config;
let client: BetterstackClient;

try {
  config = loadConfig();
  client = new BetterstackClient(config);
} catch (error) {
  console.error('Failed to initialize Betterstack client:', error);
  process.exit(1);
}

// Create MCP server
const server = new McpServer({
  name: "betterstack-logs-mcp",
  version: "1.0.0",
});

// Test connection on startup
try {
  const isConnected = await client.testConnection();
  if (!isConnected) {
    console.error('Warning: Could not establish connection to Betterstack API');
  }
} catch (error) {
  console.error('Warning: Connection test failed:', error);
}

// Register all tool categories
registerSourceManagementTools(server, client);
registerQueryTools(server, client);
registerAnalysisTools(server, client);

// Add a connection test tool
server.tool(
  "test_connection",
  {},
  async () => {
    try {
      const isConnected = await client.testConnection();
      return {
        content: [
          {
            type: "text",
            text: isConnected 
              ? "✅ Successfully connected to Betterstack API"
              : "❌ Failed to connect to Betterstack API"
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Connection test failed: ${error}`
          }
        ]
      };
    }
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Betterstack Logs MCP server running on stdio");
console.error(`Default source group: ${config.defaultSourceGroup || 'none'}`);
console.error(`Default sources: ${config.defaultSources?.join(', ') || 'none'}`);
