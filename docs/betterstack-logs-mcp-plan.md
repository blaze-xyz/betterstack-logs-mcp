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

3. **Data Sources Architecture**
   Betterstack provides access to three distinct data sources:
   
   - **Recent Logs**: Real-time logs from the last few hours/days
     - Accessed via `remote()` function with source name
     - Optimal for debugging current issues
     - Lower latency queries
   
   - **Historical Logs**: Archived logs for long-term analysis
     - Accessed via `remote()` function with archive suffix
     - Useful for trend analysis and historical debugging
     - May have higher query latency
   
   - **Metrics**: Aggregated performance and system metrics
     - Accessed via separate metrics tables
     - Ideal for performance monitoring and alerting
     - Pre-aggregated for faster queries

4. **Available Tools**
   - `query_logs`: Execute custom ClickHouse SQL queries across any data source
   - `search_logs`: Simple text search across recent or historical logs
   - `get_recent_logs`: Fetch recent logs with optional filters
   - `get_historical_logs`: Query archived logs with date ranges
   - `query_metrics`: Fetch and analyze performance metrics
   - `analyze_errors`: Find and analyze error patterns across data sources
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
   - Support data source selection (recent, historical, metrics)
   - Execute queries against Betterstack API
   - Return formatted results
   
2. **search_logs tool**
   - Simple text search interface
   - Allow selection between recent and historical logs
   - Convert to ClickHouse SQL behind the scenes
   - Support for time ranges and filters

3. **get_recent_logs tool**
   - Fetch logs from last N minutes/hours
   - Query recent logs data source
   - Optional filtering by severity, source, etc.
   - Pagination support

4. **get_historical_logs tool**
   - Query archived logs with specific date ranges
   - Handle archive table naming conventions
   - Support for large time range queries
   - Implement result streaming for large datasets

5. **query_metrics tool**
   - Access pre-aggregated metrics data
   - Support common metric queries (CPU, memory, response times)
   - Enable time-series analysis
   - Return data suitable for visualization

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

## Data Source Handling

### Table Naming Conventions
Betterstack uses specific naming patterns for different data sources:

- **Recent Logs**: `t{source_id}_{source_name}_logs`
- **Historical Logs**: `t{source_id}_{source_name}_logs_archive`
- **Metrics**: `t{source_id}_{source_name}_metrics`

### Query Patterns
```sql
-- Recent logs query
SELECT dt, raw FROM remote(t123456_myapp_logs) 
WHERE dt >= now() - INTERVAL 1 HOUR

-- Historical logs query
SELECT dt, raw FROM remote(t123456_myapp_logs_archive) 
WHERE dt BETWEEN '2024-01-01' AND '2024-01-31'

-- Metrics query
SELECT dt, metric_name, value FROM remote(t123456_myapp_metrics)
WHERE metric_name = 'cpu_usage' AND dt >= now() - INTERVAL 1 DAY
```

### Data Source Selection Logic
The MCP server will intelligently route queries based on:
1. Time range requested (recent vs. historical threshold)
2. Explicit data source parameter
3. Query type (logs vs. metrics)

## Configuration Requirements

### Environment Variables
```bash
BETTERSTACK_USERNAME=<username>
BETTERSTACK_PASSWORD=<password>
BETTERSTACK_ENDPOINT=https://eu-nbg-2-connect.betterstackdata.com
BETTERSTACK_SOURCE_ID=<source_id>
BETTERSTACK_SOURCE_NAME=<source_name>
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
        "BETTERSTACK_SOURCE_ID": "<source_id>",
        "BETTERSTACK_SOURCE_NAME": "<source_name>"
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
- Phase 3 (Log Query Tools): 5-6 hours (increased due to multiple data sources)
- Phase 4 (Analysis Tools): 2-3 hours
- Phase 5 (Testing & Documentation): 2-3 hours

Total: 12-16 hours of development time