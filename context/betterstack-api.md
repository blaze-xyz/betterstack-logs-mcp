# BetterStack API Reference

This document provides a comprehensive index of BetterStack API endpoints and documentation for Claude instances working with the BetterStack Logs MCP server.

## Official Documentation

**Primary Documentation**: https://betterstack.com/docs/logs/start/

## API Structure

BetterStack Logs uses two main APIs:

### 1. Telemetry API
**Base URL**: `https://telemetry.betterstack.com`  
**Authentication**: Bearer token (`Authorization: Bearer {api_token}`)  
**Purpose**: Source and source group management

#### Key Endpoints

| Endpoint | Method | Purpose | Documentation |
|----------|--------|---------|---------------|
| `/api/v1/sources` | GET | List all log sources | [Sources API](https://betterstack.com/docs/logs/api/sources/) |
| `/api/v1/sources/{id}` | GET | Get specific source details | [Sources API](https://betterstack.com/docs/logs/api/sources/) |
| `/api/v1/source-groups` | GET | List source groups | [Source Groups API](https://betterstack.com/docs/logs/api/source-groups/) |
| `/api/v1/source-groups/{id}` | GET | Get source group details | [Source Groups API](https://betterstack.com/docs/logs/api/source-groups/) |

**Common Parameters**:
- `page` - Page number for pagination
- `per_page` - Items per page (max 100)

**Authentication Requirements**:
- Personal API token: Access to personal sources
- Team API token: Access to team sources and source groups

### 2. ClickHouse Query API
**Base URL**: `{clickhouse_endpoint}` (varies by region)  
**Authentication**: Basic auth (`username:password`)  
**Purpose**: Log data querying and analysis

#### Key Features

| Feature | SQL Syntax | Purpose |
|---------|------------|---------|
| Recent logs | `SELECT * FROM remote(table_name)` | Query recent log data |
| Historical logs | `SELECT * FROM remote(table_name_historical)` | Query archived logs |
| Metrics | `SELECT * FROM remote(table_name_metrics)` | Query aggregated metrics |
| Time filtering | `WHERE dt >= now() - INTERVAL 1 HOUR` | Filter by time range |
| JSON querying | `WHERE json.field = 'value'` | Query structured log data |

**Common Fields**:
- `dt` - Log timestamp (DateTime)
- `raw` - Raw log message (String)
- `level` - Log level (String)
- `json` - Structured log data (JSON)
- `source` - Source identifier (String)

## Regional Endpoints

BetterStack uses region-specific ClickHouse endpoints:

- **US East**: `https://us-east-{N}-connect.betterstackdata.com:443`
- **EU**: `https://eu-{N}-connect.betterstackdata.com:443`

Where `{N}` is a region-specific number provided in your account settings.

## Table Naming Convention

BetterStack uses dynamic table names based on:
- Team ID
- Source configuration  
- Data type (logs, metrics, historical)

Format: `t{team_id}_{source_slug}_{data_type}`

Example: `t298009_spark_production_4_logs`

**Access Pattern**: Use `remote(table_name)` for querying across distributed tables.

## Rate Limiting

- **Telemetry API**: Standard REST API rate limits
- **ClickHouse API**: Query-based limits, typically generous for log analytics

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 401 | Unauthorized | Invalid or missing API token |
| 403 | Forbidden | Insufficient permissions, wrong token type |
| 404 | Not Found | Invalid source ID, table not found |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | BetterStack internal issues |

### ClickHouse-Specific Errors

- **Table not found**: Check table name format and data type
- **Invalid SQL syntax**: Verify ClickHouse SQL dialect usage
- **Permission denied**: Ensure proper authentication credentials

## Data Types

### Log Sources
- **Platform types**: Various (ubuntu, docker, kubernetes, etc.)
- **Retention**: Configurable per source (days)
- **Status**: Active/inactive sources

### Source Groups
- **Logical collections**: Group related sources
- **Team-level**: Require team API token access
- **Aggregation**: Combined retention and source counts

### Query Data Types
- **recent**: Live/recent log data (default)
- **historical**: Archived log data  
- **metrics**: Aggregated metrics and counters

## Best Practices

1. **Caching**: Cache source lists to reduce API calls
2. **Pagination**: Handle paginated responses for large source lists
3. **Error Handling**: Implement retries for transient failures
4. **Query Optimization**: Use LIMIT clauses to control result sizes
5. **Time Ranges**: Always include time filters for better performance

## SDK Integration Notes

This MCP server implements:
- Automatic source resolution (ID ↔ name mapping)
- Multi-source query generation
- Unified authentication handling
- Response caching with TTL
- Error translation and logging

## Troubleshooting

### Common Issues

1. **Source Groups Empty**: Requires team API token, not personal token
2. **Table Not Found**: Use `debug_table_info` tool to verify table names
3. **Authentication Errors**: Check token type and permissions
4. **Query Timeouts**: Add appropriate LIMIT clauses and time filters

### Debug Tools

- `test_connection` - Verify API connectivity
- `debug_table_info` - Show resolved table names and structure
- `list_sources` - Display available sources and IDs

For detailed API specifications and additional endpoints, refer to the official BetterStack documentation at https://betterstack.com/docs/logs/start/