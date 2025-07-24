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
   Betterstack provides access to three distinct data types:
   
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

4. **Source Management Architecture**
   Betterstack organizes logs into sources and source groups:
   
   - **Sources**: Individual log streams (e.g., website, app, server)
     - Each source has a unique ID and name
     - Can be queried individually or in combination
   
   - **Source Groups**: Collections of related sources (e.g., "production", "staging")
     - Groups multiple sources for unified querying
     - Simplifies searching across related services
   
   - **Dynamic Discovery**: 
     - Query available sources via Betterstack API
     - List source groups for easy selection
     - Cache source metadata for performance

5. **Available Tools**
   
   **Source Management Tools:**
   - `list_sources`: Get all available log sources with IDs and names
   - `list_source_groups`: Get all configured source groups
   - `get_source_info`: Get detailed information about a specific source
   - `get_source_group_info`: Get detailed information about a specific source group
   
   **Query Tools:**
   - `query_logs`: Execute custom ClickHouse SQL queries
     - Accepts source IDs, source group names, or defaults to configured default
     - Supports querying multiple sources simultaneously
   - `search_logs`: Simple text search across logs
     - Intelligent source selection based on query context
     - Can specify sources or use defaults
   - `get_recent_logs`: Fetch recent logs with optional filters
     - Defaults to configured source group
     - Can override with specific sources
   - `get_historical_logs`: Query archived logs with date ranges
   - `query_metrics`: Fetch and analyze performance metrics
   
   **Analysis Tools:**
   - `analyze_errors`: Find and analyze error patterns
     - Can focus on specific sources or search across all
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

### Phase 3: Source Management & Query Tools

**Source Management Tools:**
1. **list_sources tool**
   - Query Betterstack API for available sources
   - Cache results for performance
   - Return source IDs, names, and metadata

2. **list_source_groups tool**
   - Fetch configured source groups
   - Show which sources belong to each group
   - Support filtering by group attributes

3. **get_source_info tool**
   - Get detailed information about specific sources
   - Include data retention, volume statistics
   - Show recent activity indicators

4. **get_source_group_info tool**
   - Get detailed information about a specific source group
   - List all sources within the group with their IDs and names
   - Show aggregate statistics (total volume, combined retention)
   - Display group configuration and metadata
   - Useful for understanding what "production" actually includes

**Query Tools:**
1. **query_logs tool**
   - Accept ClickHouse SQL queries
   - Support source/group selection via parameters
   - Handle multi-source queries with UNION operations
   - Execute queries against Betterstack API
   - Return formatted results
   
2. **search_logs tool**
   - Simple text search interface
   - Intelligent source selection based on context
   - Allow explicit source/group override
   - Convert to ClickHouse SQL behind the scenes
   - Support for time ranges and filters

3. **get_recent_logs tool**
   - Fetch logs from last N minutes/hours
   - Use configured default sources/groups
   - Optional filtering by severity, source, etc.
   - Pagination support

4. **get_historical_logs tool**
   - Query archived logs with specific date ranges
   - Handle archive table naming for multiple sources
   - Support for large time range queries
   - Implement result streaming for large datasets

5. **query_metrics tool**
   - Access pre-aggregated metrics data
   - Support source-specific metric queries
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
5. **Advanced Testing (Future)**: 
   - Code coverage reporting, performance testing, and Codecov integration
   - End-to-end MCP protocol testing using `McpTestHelper` (currently unused but available)
   - True request/response cycle validation for Claude integration

## Data Source Handling

### Table Naming Conventions
Betterstack uses specific naming patterns for different data sources:

- **Recent Logs**: `t{source_id}_{source_name}_logs`
- **Historical Logs**: `t{source_id}_{source_name}_logs_archive`
- **Metrics**: `t{source_id}_{source_name}_metrics`

### Query Patterns
```sql
-- Single source query
SELECT dt, raw FROM remote(t123456_website_logs) 
WHERE dt >= now() - INTERVAL 1 HOUR

-- Multi-source query (using UNION)
SELECT dt, raw, 'website' as source FROM remote(t123456_website_logs) 
WHERE dt >= now() - INTERVAL 1 HOUR
UNION ALL
SELECT dt, raw, 'app' as source FROM remote(t789012_app_logs) 
WHERE dt >= now() - INTERVAL 1 HOUR
UNION ALL
SELECT dt, raw, 'server' as source FROM remote(t345678_server_logs) 
WHERE dt >= now() - INTERVAL 1 HOUR

-- Source group query (production = website + app + server)
-- The MCP will automatically expand source groups into UNION queries

-- Historical logs query
SELECT dt, raw FROM remote(t123456_website_logs_archive) 
WHERE dt BETWEEN '2024-01-01' AND '2024-01-31'

-- Metrics query
SELECT dt, metric_name, value FROM remote(t123456_website_metrics)
WHERE metric_name = 'response_time' AND dt >= now() - INTERVAL 1 DAY
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
BETTERSTACK_DEFAULT_SOURCE_GROUP=production  # Optional: default source group
BETTERSTACK_DEFAULT_SOURCES=123456,789012     # Optional: comma-separated source IDs
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
        "BETTERSTACK_DEFAULT_SOURCE_GROUP": "production"
      }
    }
  }
}
```

### Source Selection Logic
1. If a tool is called with explicit source/group parameters, use those
2. If no sources specified, use the default source group (if configured)
3. If no default source group, use default sources (if configured)
4. If no defaults configured, prompt user to select sources
5. AI can intelligently suggest sources based on the query context

### AI Source Intelligence
The MCP server enables AI assistants to intelligently work with sources:

1. **Contextual Source Selection**
   - When user mentions "website errors", AI can focus on website source
   - For "production issues", AI uses the production source group
   - Generic queries default to configured source group

2. **Source Discovery Flow**
   - AI can call `list_sources` to show available options
   - Use `list_source_groups` to understand logical groupings
   - Suggest appropriate sources based on query type

3. **Conversation Examples**
   - User: "Show me recent errors"
     - AI: Uses default source group (production)
   - User: "Show me website errors from last hour"
     - AI: Automatically selects website source
   - User: "What sources are available?"
     - AI: Calls `list_sources` and presents options
   - User: "What's included in the production source group?"
     - AI: Calls `get_source_group_info('production')` and shows all included sources
   - User: "How much data is in our production logs?"
     - AI: Uses `get_source_group_info` to show aggregate statistics

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
- Phase 3 (Source Management & Query Tools): 6-8 hours
  - Source management tools: 2-3 hours
  - Query tools with multi-source support: 4-5 hours
- Phase 4 (Analysis Tools): 2-3 hours
- Phase 5 (Testing & Documentation): 3-4 hours

Total: 14-19 hours of development time