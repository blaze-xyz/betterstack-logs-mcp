# Testing Best Practices

This document outlines the testing best practices and architecture decisions for the Betterstack Logs MCP server.

## Testing Philosophy

### Two-Tier Testing Strategy

We employ a **two-tier testing approach** that separates concerns and provides comprehensive coverage:

1. **Unit Tests** (`tests/unit/`) - Test business logic in isolation
2. **Integration Tests** (`tests/integration/`) - Test through real MCP protocol

### Key Principle: Test the Real Thing

> **Golden Rule**: Integration tests must use the actual MCP server and protocol, not inline function duplications.

**Why**: Integration tests should validate the same code path that Claude uses when interacting with the server. Testing inline functions creates false confidence and doesn't catch MCP protocol issues.

## Unit Testing Best Practices

### Structure
- **Location**: `tests/unit/`
- **Pattern**: `{tool-name}.test.ts` (e.g., `list-sources.test.ts`, `query-logs.test.ts`)
- **Focus**: Business logic, API interactions, data transformations
- **Organization**: One test file per tool for better maintainability

### Key Practices
- Mock external APIs using MSW (Mock Service Worker)
- Test error conditions and edge cases
- Validate caching behavior
- Keep tests fast and isolated

### Example Structure
```typescript
// tests/unit/list-sources.test.ts
describe('List Sources Tool', () => {
  let client: BetterstackClient

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig())
  })

  describe('listSources', () => {
    it('should return list of sources')
    it('should return empty array when no sources available')
    it('should handle API errors gracefully')
    it('should cache sources and return cached data on subsequent calls')
  })
})
```

## Integration Testing Best Practices

### Architecture: Real MCP Server Testing

Integration tests use **actual MCP server instances** through our custom testing infrastructure:

1. **Test Server Factory** (`tests/helpers/test-server-factory.ts`)
   - Creates real MCP server instances with all tools registered
   - Uses same tool registration functions as production server
   - Ensures test and production environments are identical

2. **MCP Test Helper** (`tests/helpers/mcp-test-helper.ts`)
   - Provides interface to call MCP tools through real protocol
   - Accesses server internals via `_registeredTools` registry
   - Validates MCP response format compliance

### Key Implementation Details

#### Tool Calling Mechanism
```typescript
// Discovered through debugging: MCP tools use 'callback' property
if (tool.callback && typeof tool.callback === 'function') {
  result = await tool.callback(args)
}
```

#### MCP Response Validation
```typescript
// All MCP responses must follow this format
if (!result || !result.content || !Array.isArray(result.content)) {
  throw new Error(`Invalid MCP response format`)
}
```

### Integration Test Structure
- **Location**: `tests/integration/`
- **Pattern**: `{tool-name}-integration.test.ts` (e.g., `list-sources-integration.test.ts`, `query-logs-integration.test.ts`)
- **Organization**: One integration test file per tool for better maintainability

```typescript
// tests/integration/list-sources-integration.test.ts
describe('List Sources Integration Tests', () => {
  let server: McpServer
  let mcpHelper: McpTestHelper

  beforeEach(() => {
    const testServer = createTestServer()
    server = testServer.server
    mcpHelper = new McpTestHelper(server)
  })

  describe('list_sources tool via MCP protocol', () => {
    it('should return properly formatted MCP response', async () => {
      const result = await mcpHelper.callTool('list_sources')
      expect(result.content[0].type).toBe('text')
    })
  })
})
```

## Tool Registration Best Practices

### Single Source of Truth
- **Never duplicate tools** between production and test environments
- Tools should be defined once in `src/tools/` modules
- Both production (`src/index.ts`) and tests use same registration functions

### Tool Organization
```
src/tools/
├── source-management.ts    # Source/connectivity tools
├── query-tools.ts         # Log querying tools  
└── analysis-tools.ts      # Analysis and aggregation tools
```

### Registration Pattern
```typescript
export function registerSourceManagementTools(server: McpServer, client: BetterstackClient) {
  server.tool("tool_name", { schema }, async (params) => {
    // Implementation
    return { content: [{ type: "text", text: "result" }] }
  })
}
```

## CI/CD Pipeline Structure

### Separate Job Architecture
We use **two separate CI jobs** for optimal feedback and resource usage:

```yaml
jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps: [checkout, setup, build, test:unit]

  integration-tests:  
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests  # Only run if unit tests pass
    steps: [checkout, setup, build, test:integration]
```

**Benefits**:
- Faster feedback from unit tests
- Integration tests only run if basics pass
- Clear separation of test types
- Better resource utilization

## Mock Strategy

### MSW (Mock Service Worker)
We use MSW for consistent API mocking across unit and integration tests:

```typescript
// Setup in test-setup.ts
const server = setupServer(
  http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
    return HttpResponse.json({ data: mockSources })
  })
)
```

### Mock Data Consistency
- Use realistic mock data that mirrors actual API responses
- Test both success and error scenarios
- Mock network failures for resilience testing

## Discovered Patterns

### MCP Server Internal Structure
Through debugging, we discovered:
- Tools are stored in `server._registeredTools` registry
- Tools have `callback` property (not `handler`) for execution
- Registry can be Map or Object depending on MCP SDK version

### Testing MCP Protocol
- Always validate `{ content: [...] }` response format
- Test MCP compliance, not just business logic
- Use `McpTestHelper.callTool()` for protocol-level testing

## Anti-Patterns to Avoid

❌ **Don't**: Create inline function duplications in integration tests
```typescript
// BAD: Duplicates business logic
const mockListSources = () => { /* reimplemented logic */ }
```

✅ **Do**: Use real MCP server through protocol
```typescript
// GOOD: Tests actual MCP protocol
const result = await mcpHelper.callTool('list_sources')
```

❌ **Don't**: Mix unit and integration test concerns  
❌ **Don't**: Duplicate tool registrations between environments  
❌ **Don't**: Skip MCP response format validation  
❌ **Don't**: Create consolidated test files with multiple tools  
✅ **Do**: Create individual test files per tool per test type

## Test File Organization

### File Structure Preference
We use **individual test files per tool per test type** for better maintainability and clarity:

```
tests/
├── unit/
│   ├── list-sources.test.ts           # Unit tests for list_sources tool
│   ├── get-source-info.test.ts        # Unit tests for get_source_info tool  
│   ├── query-logs.test.ts             # Unit tests for query_logs tool
│   └── test-connection.test.ts        # Unit tests for test_connection tool
└── integration/
    ├── list-sources-integration.test.ts           # Integration tests for list_sources tool
    ├── get-source-info-integration.test.ts        # Integration tests for get_source_info tool
    ├── query-logs-integration.test.ts             # Integration tests for query_logs tool
    ├── test-connection-integration.test.ts        # Integration tests for test_connection tool
    └── source-management-workflows-integration.test.ts  # Cross-tool workflow tests
```

### Benefits of Individual Files
- **Focused testing**: Each file contains tests for a single tool
- **Better maintainability**: Easier to locate and modify specific tool tests
- **Clearer organization**: Obvious mapping between tools and test files
- **Reduced merge conflicts**: Developers working on different tools won't conflict
- **Faster test discovery**: IDEs can quickly navigate to relevant tests

## Test Maintenance

### When Adding New Tools
1. Create dedicated unit test file: `{tool-name}.test.ts`
2. Create dedicated integration test file: `{tool-name}-integration.test.ts`
3. Add unit tests for business logic in the dedicated unit file
4. Add integration tests for MCP protocol compliance in the dedicated integration file
5. Update CI pipeline if needed
6. Ensure tools are registered in appropriate modules

### When Debugging Test Failures
1. Check MCP server tool registration
2. Verify `_registeredTools` structure
3. Confirm tool calling mechanism (`callback` vs `handler`)
4. Validate MCP response format compliance

## Performance Considerations

- Unit tests should be fast (< 100ms per test)
- Integration tests can be slower but should complete within reasonable time
- Use MSW to avoid actual network calls in tests
- Leverage test parallelization where possible

---

*This document reflects lessons learned during the implementation of our comprehensive testing strategy and should be updated as we discover new patterns and best practices.*