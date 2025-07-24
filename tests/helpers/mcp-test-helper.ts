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