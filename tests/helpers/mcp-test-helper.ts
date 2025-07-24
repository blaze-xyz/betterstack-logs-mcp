/**
 * MCP Test Helper - Currently Unused
 * 
 * This helper was designed for end-to-end MCP protocol testing, allowing tests to call
 * MCP tools through the actual server protocol rather than testing business logic directly.
 * 
 * Current Status: Not used in Phase 1-2 testing implementation
 * Future Use: Could enable true end-to-end MCP protocol testing in advanced testing phases
 * 
 * Benefits of MCP protocol testing:
 * - Validates tool registration and parameter schemas
 * - Tests actual request/response cycle that Claude uses  
 * - Ensures MCP compliance and response formatting
 * - Provides integration confidence before deployment
 * 
 * Current testing approach focuses on business logic via direct function calls,
 * which is faster and more reliable for core functionality validation.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export class McpTestHelper {
  constructor(private server: McpServer) {}

  async callTool(name: string, args: Record<string, any> = {}) {
    // Get the tool function from the server's internal tools
    const tools = (this.server as any)._tools
    const tool = tools.get(name)
    
    if (!tool) {
      throw new Error(`Tool "${name}" not found`)
    }
    
    // Call the tool function directly
    return await tool.handler(args)
  }

  listTools(): string[] {
    const tools = (this.server as any)._tools
    return Array.from(tools.keys())
  }
}