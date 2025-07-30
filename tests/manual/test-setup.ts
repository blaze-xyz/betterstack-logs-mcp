/**
 * Test Setup for Manual Tests - Initialize MSW server and global environment
 */
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { 
  mockApiSources, 
  mockApiSourceGroups, 
  mockClickHouseResponse
} from '../__mocks__/betterstack-responses.js'

// Setup MSW server for API mocking - copying from handlers.ts but local
const server = setupServer(
  // Betterstack Telemetry API - List sources
  http.get('https://telemetry.betterstack.com/api/v1/sources', ({ request }) => {
    const url = new URL(request.url)
    const page = url.searchParams.get('page') || '1'
    const perPage = url.searchParams.get('per_page') || '50'
    
    return HttpResponse.json({
      data: mockApiSources,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(perPage),
        total_pages: 1,
        total_count: mockApiSources.length
      }
    })
  }),

  // ClickHouse query endpoint
  http.post('https://clickhouse.betterstack.com/', async ({ request }) => {
    const query = await request.text()
    
    // Handle test connection query
    if (query.includes('SELECT 1')) {
      return HttpResponse.json({ data: [{ "1": 1 }] })
    }
    
    // Handle DESCRIBE queries for table schema validation
    if (query.includes('DESCRIBE TABLE remote(') || query.includes('DESCRIBE remote(')) {
      return HttpResponse.json({
        data: [
          ['dt', 'DateTime', '', '', '', '', ''],
          ['raw', 'String', '', '', '', '', ''],
          ['level', 'String', '', '', '', '', ''],
          ['json', 'String', '', '', '', '', ''],
          ['source', 'String', '', '', '', '', '']
        ]
      })
    }
    
    // Handle regular queries
    return HttpResponse.json(mockClickHouseResponse)
  })
)

export function setupManualTestEnvironment(): void {
  // Enable request interception
  server.listen({ onUnhandledRequest: 'error' })
  
  // Make server available globally for tests
  (globalThis as any).__MSW_SERVER__ = server
}

export function teardownManualTestEnvironment(): void {
  // Clean up after tests
  if ((globalThis as any).__MSW_SERVER__) {
    server.close()
    delete (globalThis as any).__MSW_SERVER__
  }
}

export function resetMockHandlers(): void {
  // Reset any runtime request handlers
  if ((globalThis as any).__MSW_SERVER__) {
    server.resetHandlers()
  }
}