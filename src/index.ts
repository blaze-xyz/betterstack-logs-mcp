#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from './config.js';
import { BetterstackClient } from './betterstack-client.js';
import { registerSourceManagementTools } from './tools/source-management.js';
import { registerQueryTools } from './tools/query-tools.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    transport: {
      type: 'string',
      short: 't',
      default: 'stdio'
    },
    port: {
      type: 'string',
      short: 'p',
      default: '3000'
    },
    help: {
      type: 'boolean',
      short: 'h'
    }
  }
});

if (values.help) {
  console.log(`
BetterStack Logs MCP Server - Model Context Protocol server for log analysis

Usage: 
  npx @blaze-money/betterstack-logs-mcp [options]
  betterstack-logs-mcp [options]

Options:
  -t, --transport <type>  Transport type: stdio or http (default: stdio)
  -p, --port <port>       Port for HTTP transport (default: 3000)
  -h, --help              Show this help message

Environment Variables (Required):
  BETTERSTACK_API_TOKEN           Your BetterStack API token
  BETTERSTACK_CLICKHOUSE_USERNAME ClickHouse database username  
  BETTERSTACK_CLICKHOUSE_PASSWORD ClickHouse database password
  BETTERSTACK_CLICKHOUSE_ENDPOINT ClickHouse connection endpoint

Claude Code MCP Configuration Example:
  {
    "mcpServers": {
      "betterstack-logs": {
        "command": "npx",
        "args": ["@blaze-money/betterstack-logs-mcp"],
        "env": {
          "BETTERSTACK_API_TOKEN": "your-token-here",
          "BETTERSTACK_CLICKHOUSE_USERNAME": "your-username",
          "BETTERSTACK_CLICKHOUSE_PASSWORD": "your-password",
          "BETTERSTACK_CLICKHOUSE_ENDPOINT": "your-endpoint"
        }
      }
    }
  }
  `);
  process.exit(0);
}

const transport = values.transport as 'stdio' | 'http';
const port = parseInt(values.port as string, 10);

if (transport !== 'stdio' && transport !== 'http') {
  console.error('Error: transport must be either "stdio" or "http"');
  process.exit(1);
}

// Setup logging using shared utility
import { createLogger, getLogFilePath } from './utils/logging.js';

const logToFile = createLogger(import.meta.url);
const logFile = getLogFilePath(import.meta.url);

// Load configuration
let config;
let client: BetterstackClient;

try {
  logToFile('INFO', 'Loading configuration...');
  config = loadConfig();
  logToFile('INFO', 'Configuration loaded successfully', config);
  
  logToFile('INFO', 'Initializing Betterstack client...');
  client = new BetterstackClient(config);
  logToFile('INFO', 'Betterstack client initialized');
} catch (error) {
  logToFile('ERROR', 'Failed to initialize Betterstack client', error);
  console.error('❌ BetterStack Logs MCP Server - Configuration Error');
  console.error('');
  if (error instanceof Error && error.message.includes('Missing required environment variables')) {
    console.error('Missing required environment variables. Please ensure you have set:');
    console.error('  • BETTERSTACK_API_TOKEN');
    console.error('  • BETTERSTACK_CLICKHOUSE_USERNAME');
    console.error('  • BETTERSTACK_CLICKHOUSE_PASSWORD');
    console.error('  • BETTERSTACK_CLICKHOUSE_ENDPOINT');
    console.error('');
    console.error('Run with --help for configuration examples.');
  } else {
    console.error('Error:', error);
  }
  process.exit(1);
}

// Create MCP server
const server = new McpServer({
  name: "betterstack-logs-mcp",
  version: "1.0.0",
});

// Test connection on startup
try {
  logToFile('INFO', 'Testing connection to Betterstack API...');
  const isConnected = await client.testConnection();
  if (!isConnected) {
    logToFile('WARN', 'Could not establish connection to Betterstack API');
    console.error('Warning: Could not establish connection to Betterstack API');
  } else {
    logToFile('INFO', 'Successfully connected to Betterstack API');
  }
} catch (error) {
  logToFile('ERROR', 'Connection test failed', error);
  console.error('Warning: Connection test failed:', error);
}

// Register all tool categories
registerSourceManagementTools(server, client);
registerQueryTools(server, client);


// Start the server
logToFile('INFO', `Starting MCP server with ${transport} transport...`);

if (transport === 'stdio') {
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  
  logToFile('INFO', 'MCP server started successfully on stdio', {
    transport: 'stdio',
    defaultSourceGroup: config.defaultSourceGroup,
    defaultSources: config.defaultSources,
    logFile: logFile
  });

  console.error("Betterstack Logs MCP server running on stdio");
  console.error(`Default source group: ${config.defaultSourceGroup || 'none'}`);
  console.error(`Default sources: ${config.defaultSources?.join(', ') || 'none'}`);
  console.error(`Debug logs: ${logFile}`);
} else if (transport === 'http') {
  // Create streamable HTTP transport
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => Math.random().toString(36).substring(7),
    enableJsonResponse: false
  });
  
  // Connect server to HTTP transport
  await server.connect(httpTransport);
  
  const express = await import('express');
  const { default: expressApp } = express;
  const app = expressApp();
  
  app.use(express.default.json());
  
  // CORS headers for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
  
  // MCP endpoint - handle both GET (SSE) and POST requests
  app.all("/mcp", async (req, res) => {
    try {
      await httpTransport.handleRequest(req, res, req.body);
    } catch (error) {
      logToFile('ERROR', 'Error handling MCP request', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
  
  const httpServer = app.listen(port, () => {
    logToFile('INFO', 'MCP server started successfully on HTTP', {
      transport: 'http',
      port: port,
      endpoint: `http://localhost:${port}/mcp`,
      defaultSourceGroup: config.defaultSourceGroup,
      defaultSources: config.defaultSources,
      logFile: logFile
    });

    console.error(`Betterstack Logs MCP server running on http://localhost:${port}`);
    console.error(`MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`Default source group: ${config.defaultSourceGroup || 'none'}`);
    console.error(`Default sources: ${config.defaultSources?.join(', ') || 'none'}`);
    console.error(`Debug logs: ${logFile}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logToFile('INFO', 'Received SIGINT, shutting down gracefully...');
    httpServer.close(async () => {
      await httpTransport.close();
      logToFile('INFO', 'HTTP server and transport closed');
      process.exit(0);
    });
  });
}
