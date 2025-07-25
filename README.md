# Betterstack Logs MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to query and analyze logs from Betterstack. Supports querying across multiple sources and source groups with intelligent source selection.

## Features

- **Multi-source querying**: Query individual sources or source groups
- **Source management**: Discover and inspect available sources and groups
- **Query tools**: Execute custom ClickHouse SQL or use simplified search interfaces
- **Historical data**: Access both recent and archived logs
- **Metrics support**: Query performance metrics alongside logs
- **AI-friendly**: Intelligent source selection based on query context

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Configure environment variables (see Configuration section)

## Configuration

### Environment Variables

Betterstack requires two different authentication methods:

Copy `.env.example` to `.env` and configure:

```bash
# ClickHouse Database Credentials (for log queries)
BETTERSTACK_CLICKHOUSE_USERNAME=your_clickhouse_username
BETTERSTACK_CLICKHOUSE_PASSWORD=your_clickhouse_password
BETTERSTACK_CLICKHOUSE_QUERY_ENDPOINT=your_clickhouse_endpoint_url

# API Token (for source management)
BETTERSTACK_API_TOKEN=your_api_token_from_betterstack_dashboard

# Optional
BETTERSTACK_DEFAULT_SOURCE_GROUP=production
```

**Getting Your Credentials:**

1. **ClickHouse Credentials** (for log queries):
   - In Betterstack dashboard: **Dashboards** → **Connect remotely** → **Create connection**
   - Save the generated username, password, and endpoint URL

2. **API Token** (for source management):
   - Go to [Betterstack API Tokens](https://betterstack.com/settings/api-tokens/0)
   - Select your team  
   - Create or copy an existing **Telemetry API** token

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "betterstack-logs": {
      "command": "node",
      "args": ["path/to/betterstack-logs-mcp/dist/index.js"],
      "env": {
        "BETTERSTACK_CLICKHOUSE_USERNAME": "your_clickhouse_username",
        "BETTERSTACK_CLICKHOUSE_PASSWORD": "your_clickhouse_password",
        "BETTERSTACK_CLICKHOUSE_QUERY_ENDPOINT": "your_clickhouse_endpoint_url",
        "BETTERSTACK_API_TOKEN": "your_api_token_here",
        "BETTERSTACK_DEFAULT_SOURCE_GROUP": "production"
      }
    }
  }
}
```

## Available Tools

### Source Management
- `list_sources`: Get all available log sources
- `list_source_groups`: Get configured source groups
- `get_source_info`: Get details about a specific source
- `get_source_group_info`: Get details about a source group

### Query Tools
- `query_logs`: Execute custom ClickHouse SQL queries
- `search_logs`: Simple text search across logs
- `get_recent_logs`: Fetch recent logs with filters
- `get_historical_logs`: Query archived logs
- `query_metrics`: Access performance metrics

### Analysis Tools
- `analyze_errors`: Find and analyze error patterns
- `export_logs`: Export logs in JSON/CSV formats

## Usage Examples

```bash
# List available sources
AI: What sources do we have?

# Search recent errors in production
AI: Show me recent errors from the production environment

# Query specific source
AI: Show me website logs from the last hour

# Get source group details
AI: What's included in our production source group?
```

## Development

```bash
npm run dev    # Watch mode
npm run build  # Build for production
```

## License

MIT