# MCP Testing Framework - Technical Specifications

## Architecture Overview

The testing framework will be built using **Vitest** as the primary testing framework, with a modular architecture that supports unit, integration, and end-to-end testing of all MCP tools.

```
tests/
├── __mocks__/           # Mock data and API responses
├── fixtures/            # Test data and sample responses
├── helpers/             # Test utilities and setup functions
├── unit/                # Unit tests for individual tools
├── integration/         # Integration tests with mocked APIs
├── e2e/                 # End-to-end MCP protocol tests
└── performance/         # Performance and load tests
```

## Technology Stack

### Core Testing Framework
- **Vitest**: Fast, modern testing framework with TypeScript support
- **@vitest/ui**: Web-based test runner interface
- **c8**: Code coverage reporting

### Mocking and Test Data
- **msw** (Mock Service Worker): HTTP request mocking
- **@faker-js/faker**: Test data generation
- **nock**: HTTP mocking for Node.js (fallback option)

### MCP Testing Utilities
- **@modelcontextprotocol/sdk**: MCP server testing utilities
- Custom MCP client wrapper for test scenarios

### CI/CD Integration
- **GitHub Actions**: Automated test execution
- **codecov**: Coverage reporting and visualization

## Implementation Details

### 1. Test Environment Setup

```typescript
// tests/setup.ts
import { beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './__mocks__/handlers'

// Setup MSW server for API mocking
const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  server.resetHandlers()
})
```

### 2. Mock Data Structure

```typescript
// tests/__mocks__/betterstack-responses.ts
export const mockSources = [
  {
    id: 1021715,
    name: "Spark - staging | deprecated",
    platform: "ubuntu",
    retention_days: 7,
    // ... other properties
  },
  // ... more sources
]

export const mockLogs = [
  {
    timestamp: "2024-01-15T10:30:00Z",
    message: "Application started successfully",
    severity: "info",
    source_id: 1021715,
    // ... other log properties
  },
  // ... more logs
]
```

### 3. API Mock Handlers

```typescript
// tests/__mocks__/handlers.ts
import { http, HttpResponse } from 'msw'
import { mockSources, mockLogs } from './betterstack-responses'

export const handlers = [
  // Betterstack API endpoints
  http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
    return HttpResponse.json({ data: mockSources })
  }),
  
  // ClickHouse endpoints
  http.post('*/query', async ({ request }) => {
    const body = await request.text()
    // Parse SQL and return appropriate mock data
    return HttpResponse.json(mockQueryResponse(body))
  }),
  
  // Error scenarios
  http.get('*/error-endpoint', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  })
]
```

### 4. Unit Test Structure

```typescript
// tests/unit/source-management.test.ts
import { describe, it, expect, vi } from 'vitest'
import { BetterstackClient } from '../../src/betterstack-client'
import { listSources } from '../../src/tools/source-management'

describe('Source Management Tools', () => {
  describe('listSources', () => {
    it('should return formatted list of sources', async () => {
      const mockClient = new BetterstackClient({
        apiToken: 'test-token',
        clickhouseUsername: 'test-user',
        clickhousePassword: 'test-pass',
        clickhouseEndpoint: 'test-endpoint'
      })
      
      const result = await listSources(mockClient)
      
      expect(result).toContain('Available Log Sources')
      expect(result).toContain('Spark - staging')
      expect(result).toContain('Platform: ubuntu')
    })
    
    it('should handle API errors gracefully', async () => {
      // Test error handling
    })
    
    it('should handle empty source list', async () => {
      // Test edge case
    })
  })
})
```

### 5. Integration Test Structure

```typescript
// tests/integration/query-workflow.test.ts
import { describe, it, expect } from 'vitest'
import { createMCPServer } from '../../src/index'

describe('Query Workflow Integration', () => {
  it('should complete source discovery to log query workflow', async () => {
    const server = createMCPServer()
    
    // 1. List sources
    const sourcesResult = await server.call('list_sources', {})
    expect(sourcesResult).toBeDefined()
    
    // 2. Query logs from discovered source
    const logsResult = await server.call('get_recent_logs', {
      sources: ['1021715'],
      limit: 10
    })
    expect(logsResult).toBeDefined()
    expect(logsResult).toContain('timestamp')
  })
})
```

### 6. End-to-End Test Structure

```typescript
// tests/e2e/mcp-protocol.test.ts
import { describe, it, expect } from 'vitest'
import { MCPTestClient } from '../helpers/mcp-test-client'

describe('MCP Protocol E2E Tests', () => {
  it('should handle complete tool lifecycle via MCP protocol', async () => {
    const client = new MCPTestClient()
    await client.connect()
    
    // Test tool discovery
    const tools = await client.listTools()
    expect(tools).toHaveLength(15)
    
    // Test tool execution
    const result = await client.callTool('list_sources', {})
    expect(result.isError).toBe(false)
    expect(result.content).toBeTruthy()
    
    await client.disconnect()
  })
})
```

### 7. Performance Test Structure

```typescript
// tests/performance/load-testing.test.ts
import { describe, it, expect } from 'vitest'
import { performance } from 'perf_hooks'

describe('Performance Tests', () => {
  it('should handle large log queries within time limits', async () => {
    const start = performance.now()
    
    const result = await queryLogs({
      query: 'SELECT * FROM logs LIMIT 10000',
      sources: ['1021715']
    })
    
    const duration = performance.now() - start
    expect(duration).toBeLessThan(5000) // 5 seconds max
    expect(result).toBeDefined()
  })
})
```

### 8. Test Utilities and Helpers

```typescript
// tests/helpers/mcp-test-client.ts
export class MCPTestClient {
  private transport: any
  
  async connect() {
    // Setup MCP transport for testing
  }
  
  async callTool(name: string, args: any) {
    // Execute tool via MCP protocol
  }
  
  async listTools() {
    // Get available tools
  }
  
  async disconnect() {
    // Cleanup connection
  }
}

// tests/helpers/test-data.ts
export const createTestEnvironment = () => {
  return {
    apiToken: 'test-token-123',
    clickhouseUsername: 'test-user',
    clickhousePassword: 'test-password',
    clickhouseEndpoint: 'https://test.clickhouse.com'
  }
}

export const generateLogEntry = (overrides = {}) => {
  return {
    timestamp: new Date().toISOString(),
    message: 'Test log message',
    severity: 'info',
    source_id: 1021715,
    ...overrides
  }
}
```

## Test Data Management

### Mock Response Generation

```typescript
// tests/fixtures/response-generator.ts
export class ResponseGenerator {
  static generateSourcesResponse(count = 5) {
    return Array.from({ length: count }, (_, i) => ({
      id: 1021715 + i,
      name: `Test Source ${i + 1}`,
      platform: 'ubuntu',
      retention_days: 7
    }))
  }
  
  static generateLogsResponse(count = 100) {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      message: `Log message ${i + 1}`,
      severity: ['info', 'warn', 'error'][i % 3],
      source_id: 1021715
    }))
  }
}
```

### Environment Configuration

```typescript
// tests/helpers/config.ts
export const testConfig = {
  mocks: {
    enableNetworkMocks: process.env.NODE_ENV === 'test',
    useRealAPI: process.env.USE_REAL_API === 'true'
  },
  timeouts: {
    unitTest: 5000,
    integrationTest: 15000,
    e2eTest: 30000
  },
  coverage: {
    threshold: 80,
    excludePatterns: ['**/__mocks__/**', '**/fixtures/**']
  }
}
```

## CI/CD Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      
      - run: npm ci
      - run: npm run build
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "test:performance": "vitest run tests/performance",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --coverage --reporter=verbose"
  }
}
```

## Error Handling and Edge Cases

### Test Categories for Error Scenarios

1. **Network Errors**: Connection timeouts, DNS failures
2. **Authentication Errors**: Invalid tokens, expired credentials
3. **API Errors**: Rate limiting, server errors, malformed responses
4. **Input Validation**: Invalid parameters, missing required fields
5. **Data Processing**: Malformed logs, encoding issues, large datasets

### Example Error Test

```typescript
describe('Error Handling', () => {
  it('should handle network timeouts gracefully', async () => {
    server.use(
      http.get('*/sources', () => {
        return HttpResponse.error()
      })
    )
    
    const result = await listSources(client)
    expect(result).toContain('Failed to fetch sources')
    expect(result).not.toThrow()
  })
})
```

## Test Execution Strategy

### Local Development
- Run `npm run test:watch` for continuous testing during development
- Use `npm run test:ui` for interactive test debugging
- Run specific test suites with `npm run test:unit` or `npm run test:integration`

### CI/CD Pipeline
- Run full test suite on every PR
- Generate and upload coverage reports
- Block merges if coverage drops below threshold
- Run performance tests on main branch changes

### Release Testing
- Execute full test suite including E2E tests
- Validate against staging environment
- Performance regression testing
- Compatibility testing with different Node.js versions

## Metrics and Monitoring

### Test Metrics to Track
- Test execution time by category
- Code coverage percentage by module
- Flaky test identification and tracking
- Test failure rates and patterns

### Reporting
- Coverage reports with line-by-line analysis
- Test execution reports with timing data
- Trend analysis for test performance
- Integration with project dashboards

## Migration Strategy

### Phase 1: Foundation
- Set up Vitest configuration
- Create basic test structure
- Implement mock handlers for core APIs
- Add CI/CD integration

### Phase 2: Source Management Testing
- Unit tests for source-related tools:
  - `list_sources`: Source enumeration and filtering
  - `list_source_groups`: Group discovery and organization  
  - `get_source_info`: Detailed source information retrieval
  - `get_source_group_info`: Group metadata and member listing
- Integration tests for source management workflows
- Error handling for source API failures

### Phase 3: Query Tools Testing
- Unit tests for query-related tools:
  - `query_logs`: ClickHouse SQL execution and result formatting
  - `search_logs`: Text search across different log types
  - `get_recent_logs`: Time-based filtering and pagination
  - `get_historical_logs`: Date range queries and large result handling
  - `query_metrics`: Metrics aggregation and visualization data
- Integration tests for query workflows
- Error handling for ClickHouse and query failures

### Phase 4: Analysis Tools Testing
- Unit tests for analysis-related tools:
  - `analyze_errors`: Error pattern detection and classification
  - `export_logs`: CSV/JSON export functionality and large dataset handling
  - `get_log_statistics`: Statistical computation accuracy
  - `debug_table_info`: Schema inspection capabilities
- Integration tests for analysis workflows
- Error handling for export and analysis failures

### Phase 5: Advanced Testing
- End-to-end MCP protocol tests
- Utility tools testing (`test_connection`)
- Performance and load testing
- Cross-browser compatibility (if applicable)

### Phase 6: Optimization
- Test performance optimization
- Documentation and examples
- Developer experience improvements