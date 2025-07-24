#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from './config.js';
import { BetterstackClient } from './betterstack-client.js';
import { registerSourceManagementTools } from './tools/source-management.js';
import { registerQueryTools } from './tools/query-tools.js';
import { registerAnalysisTools } from './tools/analysis-tools.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup logging - use the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = path.join(path.dirname(__dirname), 'mcp-debug.log');
const logToFile = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  fs.appendFileSync(logFile, logEntry);
  console.error(`${level}: ${message}`, data || '');
};

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
registerAnalysisTools(server, client);


// Start the server
logToFile('INFO', 'Starting MCP server...');
const transport = new StdioServerTransport();
await server.connect(transport);

logToFile('INFO', 'MCP server started successfully', {
  defaultSourceGroup: config.defaultSourceGroup,
  defaultSources: config.defaultSources,
  logFile: logFile
});

console.error("Betterstack Logs MCP server running on stdio");
console.error(`Default source group: ${config.defaultSourceGroup || 'none'}`);
console.error(`Default sources: ${config.defaultSources?.join(', ') || 'none'}`);
console.error(`Debug logs: ${logFile}`);
