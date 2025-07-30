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

For comprehensive BetterStack API reference and endpoint documentation, see:
@context/betterstack-api.md

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

## Development Workflow

### Building and Testing Changes

**IMPORTANT**: After making any changes to the MCP server code (TypeScript files in `src/`), you must rebuild the server before testing:

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory. Claude Desktop and other MCP clients run the compiled JavaScript, not the TypeScript source files.

**Development cycle:**

1. Make changes to TypeScript files in `src/`
2. Run `npm run build` to compile changes
3. Test the changes in Claude Desktop or other MCP clients
4. Debug using logs in `mcp-debug.log` (written to project root)
5. If stuck, consult BetterStack API documentation (@context/betterstack-api.md) for endpoint details and refresh your understanding of API constraints
6. Repeat as needed

Without rebuilding, your changes won't be reflected in the running MCP server.
