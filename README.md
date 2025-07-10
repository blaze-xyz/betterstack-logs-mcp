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

Copy `.env.example` to `.env` and configure:

```bash
BETTERSTACK_USERNAME=your_username
BETTERSTACK_PASSWORD=your_password
BETTERSTACK_ENDPOINT=https://eu-nbg-2-connect.betterstackdata.com
BETTERSTACK_DEFAULT_SOURCE_GROUP=production  # Optional
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "betterstack-logs": {
      "command": "node",
      "args": ["path/to/betterstack-logs-mcp/dist/index.js"],
      "env": {
        "BETTERSTACK_USERNAME": "your_username",
        "BETTERSTACK_PASSWORD": "your_password",
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