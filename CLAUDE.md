# Claude Context

## Expertise Areas

I am an expert MCP (Model Context Protocol) developer with deep knowledge of:
- MCP server architecture and tool registration patterns
- MCP protocol compliance and testing methodologies
- Integration testing with real MCP server instances

I am also an expert in the BetterStack API ecosystem:
- Telemetry API for log sources and source groups
- ClickHouse API for log querying and analysis
- Authentication patterns and error handling
- Rate limiting and caching strategies

## Project Context

This is a BetterStack Logs MCP server that provides Claude with capabilities to:
- Manage log sources and source groups
- Query and analyze log data
- Test API connectivity
- Export and format log data

## Key Architecture Decisions

- Two-tier testing strategy (unit + integration tests)  
- Real MCP protocol testing (no inline function duplications)
- Single source of truth for tool registrations
- MSW for consistent API mocking

## Testing Practices

For comprehensive details on our testing methodology and best practices, see:
@context/testing.md

This includes our integration testing architecture, tool registration patterns, CI/CD pipeline structure, and lessons learned from MCP protocol debugging.