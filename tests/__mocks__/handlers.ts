import { http, HttpResponse } from 'msw'
import { 
  mockApiSources, 
  mockApiSourceGroups, 
  mockClickHouseResponse,
  generateMockSource
} from './betterstack-responses.js'

export const handlers = [
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

  // Betterstack Telemetry API - List source groups
  http.get('https://telemetry.betterstack.com/api/v1/source-groups', ({ request }) => {
    const url = new URL(request.url)
    const page = url.searchParams.get('page') || '1'
    const perPage = url.searchParams.get('per_page') || '50'
    
    return HttpResponse.json({
      data: mockApiSourceGroups,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(perPage),
        total_pages: 1,
        total_count: mockApiSourceGroups.length
      }
    })
  }),

  // ClickHouse query endpoint - match the actual endpoint
  http.post('https://clickhouse.betterstack.com/', async ({ request }) => {
    const query = await request.text()
    
    // Handle test connection query
    if (query.includes('SELECT 1')) {
      return HttpResponse.json({ data: [{ "1": 1 }] })
    }
    
    // Handle DESCRIBE queries for table schema validation (includes remote() function)
    if (query.includes('DESCRIBE TABLE remote(') || query.includes('DESCRIBE remote(')) {
      return HttpResponse.json({
        data: [
          { name: 'dt', type: 'DateTime', default_type: '', default_expression: '', comment: '', codec_expression: '', ttl_expression: '' },
          { name: 'raw', type: 'String', default_type: '', default_expression: '', comment: '', codec_expression: '', ttl_expression: '' },
          { name: 'level', type: 'String', default_type: '', default_expression: '', comment: '', codec_expression: '', ttl_expression: '' },
          { name: 'json', type: 'String', default_type: '', default_expression: '', comment: '', codec_expression: '', ttl_expression: '' },
          { name: 'source', type: 'String', default_type: '', default_expression: '', comment: '', codec_expression: '', ttl_expression: '' }
        ]
      })
    }
    
    // Handle regular queries
    return HttpResponse.json(mockClickHouseResponse)
  }),

  // Error scenarios
  http.get('*/sources/error', () => {
    return HttpResponse.json(
      { error: 'Unauthorized', message: 'Invalid API token' },
      { status: 401 }
    )
  }),

  http.get('*/source-groups/team-error', () => {
    return HttpResponse.json(
      { 
        error: 'Forbidden',
        message: 'Team API token required',
        errors: ['Invalid Team API token']
      },
      { status: 403 }
    )
  }),

  // Network timeout simulation
  http.get('*/sources/timeout', () => {
    return HttpResponse.error()
  }),

  // Rate limiting
  http.get('*/sources/rate-limit', () => {
    return HttpResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded' },
      { status: 429 }
    )
  })
]