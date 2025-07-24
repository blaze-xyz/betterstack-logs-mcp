/**
 * Test Server Factory - Creates real MCP server instances for integration testing
 * 
 * This factory creates actual MCP server instances with all tools registered,
 * enabling true integration testing through the MCP protocol.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BetterstackClient } from '../../src/betterstack-client.js'
import { registerSourceManagementTools } from '../../src/tools/source-management.js'
import { registerQueryTools } from '../../src/tools/query-tools.js'
import { registerAnalysisTools } from '../../src/tools/analysis-tools.js'
import { createTestConfig } from './test-config.js'

export function createTestServer(): { server: McpServer, client: BetterstackClient } {
  // Create test configuration and client
  const config = createTestConfig()
  const client = new BetterstackClient(config)
  
  // Create MCP server
  const server = new McpServer({
    name: "betterstack-logs-mcp-test",
    version: "1.0.0-test",
  })
  
  // Register all tool categories (same as production server)
  registerSourceManagementTools(server, client)
  registerQueryTools(server, client)
  registerAnalysisTools(server, client)
  
  // Add test connection tool
  server.tool(
    "test_connection",
    {},
    async () => {
      try {
        const isConnected = await client.testConnection()
        return {
          content: [
            {
              type: "text",
              text: isConnected 
                ? "✅ Connection successful - both Telemetry API and ClickHouse are accessible"
                : "❌ Connection failed - check your API token and network connectivity"
            }
          ]
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text", 
              text: `❌ Connection test failed: ${error}`
            }
          ]
        }
      }
    }
  )
  
  return { server, client }
}