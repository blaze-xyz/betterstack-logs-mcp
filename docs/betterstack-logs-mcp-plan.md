# Betterstack Logs MCP Server Implementation Plan

## Overview
This document outlines the plan for creating an MCP (Model Context Protocol) server that enables AI tools to query and analyze logs from Betterstack. The server will provide a clean interface for log retrieval, searching, and analysis.

## Architecture Decision: Direct HTTP API vs. Grafana/ClickHouse

After analyzing the Betterstack documentation, I recommend using the **Direct HTTP API** approach for the following reasons:

1. **Simplicity**: Betterstack already provides a ClickHouse-compatible HTTP API endpoint
2. **No Additional Infrastructure**: No need to set up separate Grafana or ClickHouse instances
3. **Native Integration**: Direct access to Betterstack's query capabilities
4. **Lower Complexity**: Fewer moving parts and dependencies

## Technical Architecture

### Core Components

1. **MCP Server** (TypeScript)
   - Built on the `@modelcontextprotocol/sdk` framework
   - Implements tools for log querying and analysis
   - Handles authentication and API communication

2. **Betterstack Integration**
   - HTTP client for API communication
   - Authentication management
   - Query builder for ClickHouse SQL syntax
   - Response parsing and formatting

3. **Available Tools**
   - `query_logs`: Execute custom ClickHouse SQL queries
   - `search_logs`: Simple text search across logs
   - `get_recent_logs`: Fetch recent logs with optional filters
   - `analyze_errors`: Find and analyze error patterns
   - `export_logs`: Export logs in various formats (JSON, CSV)

## Implementation Steps

### Phase 1: Repository Setup
1. Initialize new git repository in blaze-xyz organization
2. Set up TypeScript project based on MCP template
3. Configure build tools and dependencies
4. Set up environment variable management for credentials

### Phase 2: Core MCP Server
1. Implement base MCP server structure
2. Create authentication handler for Betterstack credentials
3. Set up HTTP client with proper error handling
4. Implement connection testing tool

### Phase 3: Log Query Tools
1. **query_logs tool**
   - Accept ClickHouse SQL queries
   - Execute queries against Betterstack API
   - Return formatted results
   
2. **search_logs tool**
   - Simple text search interface
   - Convert to ClickHouse SQL behind the scenes
   - Support for time ranges and filters

3. **get_recent_logs tool**
   - Fetch logs from last N minutes/hours
   - Optional filtering by severity, source, etc.
   - Pagination support

### Phase 4: Analysis Tools
1. **analyze_errors tool**
   - Identify error patterns
   - Group similar errors
   - Provide error frequency statistics

2. **export_logs tool**
   - Support JSON, CSV formats
   - Handle large datasets with streaming
   - Include metadata in exports

### Phase 5: Testing & Documentation
1. Unit tests for each tool
2. Integration tests with mock Betterstack API
3. User documentation with examples
4. Configuration guide

## Configuration Requirements

### Environment Variables
```bash
BETTERSTACK_USERNAME=<username>
BETTERSTACK_PASSWORD=<password>
BETTERSTACK_ENDPOINT=https://eu-nbg-2-connect.betterstackdata.com
BETTERSTACK_SOURCE_ID=<source_id>
```

### MCP Configuration (claude_desktop_config.json)
```json
{
  "mcpServers": {
    "betterstack-logs": {
      "command": "node",
      "args": ["path/to/betterstack-logs-mcp/dist/index.js"],
      "env": {
        "BETTERSTACK_USERNAME": "<username>",
        "BETTERSTACK_PASSWORD": "<password>",
        "BETTERSTACK_SOURCE_ID": "<source_id>"
      }
    }
  }
}
```

## Security Considerations

1. **Credential Management**
   - Store credentials in environment variables
   - Never log or expose credentials
   - Implement credential validation

2. **Query Safety**
   - Validate and sanitize SQL queries
   - Implement query timeouts
   - Add rate limiting

3. **Data Privacy**
   - Respect log retention policies
   - Implement access controls
   - Sanitize sensitive data in responses

## Performance Considerations

1. **Query Optimization**
   - Always use LIMIT clauses
   - Implement pagination for large results
   - Cache frequently used queries

2. **Resource Management**
   - Stream large responses
   - Implement connection pooling
   - Add request timeouts

## Next Steps

1. Create repository in blaze-xyz organization
2. Set up initial project structure
3. Implement authentication and connection testing
4. Build first tool (get_recent_logs)
5. Iterate on additional tools based on usage patterns

## Questions for Consideration

1. What are the most common log queries your team needs?
2. Are there specific error patterns you frequently search for?
3. What export formats would be most useful?
4. Do you need real-time log streaming capabilities?
5. Should we implement log alerting features?

## Dependencies

- `@modelcontextprotocol/sdk`: MCP framework
- `axios` or `fetch`: HTTP client
- `zod`: Schema validation
- `dotenv`: Environment variable management
- `p-limit`: Rate limiting
- `csv-stringify`: CSV export support

## Estimated Timeline

- Phase 1 (Repository Setup): 1 hour
- Phase 2 (Core MCP Server): 2-3 hours
- Phase 3 (Log Query Tools): 3-4 hours
- Phase 4 (Analysis Tools): 2-3 hours
- Phase 5 (Testing & Documentation): 2-3 hours

Total: 10-14 hours of development time