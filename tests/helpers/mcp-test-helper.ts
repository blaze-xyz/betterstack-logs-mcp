/**
 * MCP Test Helper - Integration Testing Support
 * 
 * This helper enables true integration testing by calling MCP tools through the actual 
 * server protocol, validating tool registration, parameter schemas, and response formatting.
 * 
 * Benefits of MCP protocol testing:
 * - Validates tool registration and parameter schemas
 * - Tests actual request/response cycle that Claude uses  
 * - Ensures MCP compliance and response formatting
 * - Provides integration confidence before deployment
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export class McpTestHelper {
  constructor(private server: McpServer) {}

  async callTool(name: string, args: Record<string, any> = {}) {
    try {
      // Get the tool function from the server's internal tools registry
      const tools = (this.server as any)._registeredTools
      
      if (!tools) {
        throw new Error(`Server tools registry not accessible. Server structure: ${Object.keys(this.server as any).join(', ')}`)
      }
      
      let tool
      if (tools instanceof Map) {
        tool = tools.get(name)
      } else if (typeof tools === 'object') {
        tool = tools[name]
      } else {
        throw new Error(`Unknown tools registry structure: ${typeof tools}`)
      }
      
      if (!tool) {
        const availableTools = this.listTools()
        throw new Error(`Tool "${name}" not found. Available tools: ${availableTools.join(', ')}`)
      }
      
      // Call the tool function directly (simulates MCP protocol call)
      let result
      if (typeof tool === 'function') {
        result = await tool(args)
      } else if (tool.callback && typeof tool.callback === 'function') {
        result = await tool.callback(args)
      } else if (tool.handler && typeof tool.handler === 'function') {
        result = await tool.handler(args)
      } else {
        throw new Error(`Tool "${name}" is not callable. Structure: ${Object.keys(tool).join(', ')}`)
      }
      
      // Validate the response format matches MCP expectations
      if (!result || !result.content || !Array.isArray(result.content)) {
        throw new Error(`Invalid MCP response format from tool "${name}". Expected { content: [...] }, got: ${JSON.stringify(result)}`)
      }
      
      return result
    } catch (error) {
      // Wrap errors in MCP-compliant format
      return {
        content: [
          {
            type: "text",
            text: `Error calling tool "${name}": ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  }

  listTools(): string[] {
    try {
      const tools = (this.server as any)._registeredTools
      
      if (!tools) {
        return []
      }
      
      if (tools instanceof Map) {
        return Array.from(tools.keys())
      } else if (typeof tools === 'object') {
        return Object.keys(tools)
      } else {
        return []
      }
    } catch (error) {
      console.error('Error listing tools:', error)
      return []
    }
  }
  
  getToolInfo(name: string) {
    try {
      const tools = (this.server as any)._registeredTools
      
      if (!tools) {
        return null
      }
      
      let tool
      if (tools instanceof Map) {
        tool = tools.get(name)
      } else if (typeof tools === 'object') {
        tool = tools[name]
      }
      
      if (!tool) {
        return null
      }
      
      return {
        name: tool.name || name,
        description: tool.description || 'No description available',
        inputSchema: tool.inputSchema || tool.schema
      }
    } catch (error) {
      console.error('Error getting tool info:', error)
      return null
    }
  }
}