import { createTestServer } from '../../helpers/test-server-factory.js';
import { McpTestHelper } from '../../helpers/mcp-test-helper.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http, HttpResponse } from 'msw';

describe('Compact Query Workflow Integration Tests', () => {
  let server: McpServer;
  let mcpHelper: McpTestHelper;

  beforeEach(() => {
    const testServer = createTestServer();
    server = testServer.server;
    mcpHelper = new McpTestHelper(server);
  });

  describe('query_logs with compact format', () => {
    it('should return compact format with cache ID and extracted messages', async () => {
      // Mock data with structured JSON logs
      const mockData = [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"User login successful","user_id":12345,"session":"abc123"}' 
        },
        { 
          dt: '2024-01-01T10:01:00Z', 
          raw: '{"timestamp":"2024-01-01T10:01:00Z","level":"WARN","message":"Database connection slow","response_time":2500,"pool":"primary"}' 
        },
        { 
          dt: '2024-01-01T10:02:00Z', 
          raw: '{"timestamp":"2024-01-01T10:02:00Z","level":"ERROR","message":"API request failed","error_code":500,"endpoint":"/users"}' 
        }
      ];

      // Setup MSW mock for ClickHouse API
      const { http, HttpResponse } = await import('msw');
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData });
        })
      );

      const result = await mcpHelper.callTool('query_logs', {
        response_format: 'compact',
        limit: 3
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const responseText = result.content[0].text;
      
      // Verify compact format indicators
      expect(responseText).toContain('Query Results (Compact View)');
      expect(responseText).toContain('Cache ID:');
      expect(responseText).toContain('**Logs:**');
      
      // Verify enhanced compact format with source and level information  
      expect(responseText).toContain('| INFO]: User login successful');
      expect(responseText).toContain('| WARN]: Database connection slow');
      expect(responseText).toContain('| ERROR]: API request failed');
      
      // Verify full JSON is NOT shown in compact view
      expect(responseText).not.toContain('"user_id":12345');
      expect(responseText).not.toContain('"response_time":2500');
      expect(responseText).not.toContain('"error_code":500');
      
      // Verify instructions for getting details
      expect(responseText).toContain("Use 'get_log_details'");
      expect(responseText).toMatch(/cache_id='[a-f0-9]{12}'/);
      expect(responseText).toContain('log_index=N');
    });

    it('should handle logs with msg field instead of message', async () => {
      const mockData = [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","msg":"Service started","service":"auth"}' 
        }
      ];

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData });
        })
      );

      const result = await mcpHelper.callTool('query_logs', {
        response_format: 'compact',
        limit: 1
      });

      const responseText = result.content[0].text;
      expect(responseText).toContain('| INFO]: Service started');
    });

    it('should handle logs with invalid JSON gracefully', async () => {
      const mockData = [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: 'Plain text log message without JSON structure' 
        }
      ];

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData });
        })
      );

      const result = await mcpHelper.callTool('query_logs', {
        response_format: 'compact',
        limit: 1
      });

      const responseText = result.content[0].text;
      expect(responseText).toContain(']: Plain text log message without JSON structure');
    });

    it('should not create cache for empty results', async () => {
      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: [] });
        })
      );

      const result = await mcpHelper.callTool('query_logs', {
        response_format: 'compact',
        limit: 10
      });

      const responseText = result.content[0].text;
      expect(responseText).not.toContain('Cache ID:');
      expect(responseText).toContain('No results found.');
    });
  });

  describe('query_logs with full format', () => {
    it('should return full format without caching', async () => {
      const mockData = [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: '{"message":"Test log","level":"INFO"}' 
        }
      ];

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData });
        })
      );

      const result = await mcpHelper.callTool('query_logs', {
        response_format: 'full',
        limit: 1
      });

      const responseText = result.content[0].text;
      
      // Verify full format indicators
      expect(responseText).toContain('Query Results (Full View)');
      expect(responseText).toContain('**Data:**');
      
      // Verify no cache ID is provided
      expect(responseText).not.toContain('Cache ID:');
      expect(responseText).not.toContain("Use 'get_log_details'");
      
      // Verify full data is shown
      expect(responseText).toContain('dt: 2024-01-01T10:00:00Z');
      expect(responseText).toContain('raw: {"message":"Test log","level":"INFO"}');
    });
  });

  describe('get_log_details integration', () => {
    it('should retrieve cached log details successfully', async () => {
      // First, create a compact query to populate cache
      const mockData = [
        { 
          dt: '2024-01-01T10:00:00Z', 
          raw: '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"First log","details":{"user_id":123,"action":"login"}}' 
        },
        { 
          dt: '2024-01-01T10:01:00Z', 
          raw: '{"timestamp":"2024-01-01T10:01:00Z","level":"ERROR","message":"Second log","error":{"code":500,"stack":"Error trace here"}}' 
        }
      ];

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData });
        })
      );

      // Step 1: Run compact query
      const compactResult = await mcpHelper.callTool('query_logs', {
        response_format: 'compact',
        limit: 2
      });

      const compactText = compactResult.content[0].text;
      
      // Extract cache ID from response
      const cacheIdMatch = compactText.match(/Cache ID: ([a-f0-9]{12})/);
      expect(cacheIdMatch).toBeTruthy();
      const cacheId = cacheIdMatch![1];

      // Step 2: Get details for first log (index 0)
      const detailResult0 = await mcpHelper.callTool('get_log_details', {
        cache_id: cacheId,
        log_index: 0
      });

      const detailText0 = detailResult0.content[0].text;
      expect(detailText0).toContain('Log Details (Index 0)');
      expect(detailText0).toContain(`Cache ID: ${cacheId}`);
      expect(detailText0).toContain('Timestamp: 2024-01-01T10:00:00Z');
      expect(detailText0).toContain('**Full Raw Data:**');
      expect(detailText0).toContain('"user_id":123');
      expect(detailText0).toContain('"action":"login"');

      // Step 3: Get details for second log (index 1)
      const detailResult1 = await mcpHelper.callTool('get_log_details', {
        cache_id: cacheId,
        log_index: 1
      });

      const detailText1 = detailResult1.content[0].text;
      expect(detailText1).toContain('Log Details (Index 1)');
      expect(detailText1).toContain('Timestamp: 2024-01-01T10:01:00Z');
      expect(detailText1).toContain('"code":500');
      expect(detailText1).toContain('"stack":"Error trace here"');
    });

    it('should handle invalid cache ID', async () => {
      const result = await mcpHelper.callTool('get_log_details', {
        cache_id: 'invalid-cache-id',
        log_index: 0
      });

      const responseText = result.content[0].text;
      expect(responseText).toContain('❌ Cache ID not found or expired');
    });

    it('should handle invalid log index', async () => {
      // First create a cache with some data
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: '{"message":"Only log"}' }
      ];

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData });
        })
      );

      const compactResult = await mcpHelper.callTool('query_logs', {
        response_format: 'compact',
        limit: 1
      });

      const cacheIdMatch = compactResult.content[0].text.match(/Cache ID: ([a-f0-9]{12})/);
      const cacheId = cacheIdMatch![1];

      // Try to access invalid index
      const detailResult = await mcpHelper.callTool('get_log_details', {
        cache_id: cacheId,
        log_index: 5
      });

      const responseText = detailResult.content[0].text;
      expect(responseText).toContain('❌ Invalid log index: 5');
      expect(responseText).toContain('Valid range: 0-0');
    });
  });

  describe('default response format', () => {
    it('should default to compact format when no response_format specified', async () => {
      const mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: '{"message":"Default format test"}' }
      ];

      globalThis.__MSW_SERVER__.use(
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: mockData });
        })
      );

      const result = await mcpHelper.callTool('query_logs', {
        limit: 1
        // Note: no response_format specified, should default to 'compact'
      });

      const responseText = result.content[0].text;
      expect(responseText).toContain('Query Results (Compact View)');
      expect(responseText).toContain('Cache ID:'); // Compact format caches results
      expect(responseText).toContain(']: Default format test');
    });
  });
});