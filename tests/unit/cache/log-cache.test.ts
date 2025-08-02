import { BetterstackClient } from '../../../src/betterstack-client.js';
import { createTestConfig } from '../../helpers/test-config.js';
import { LogEntry, LogCache } from '../../../src/types.js';

describe('BetterstackClient Log Cache', () => {
  let client: BetterstackClient;

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig());
  });

  describe('generateCacheId', () => {
    it('should generate consistent cache IDs for identical parameters', () => {
      const query = 'SELECT dt, raw FROM logs LIMIT 10';
      const options = { sources: ['test'], limit: 10 };
      
      const id1 = client.generateCacheId(query, options);
      const id2 = client.generateCacheId(query, options);
      
      expect(id1).toBe(id2);
      expect(id1).toHaveLength(12);
    });

    it('should generate different cache IDs for different parameters', () => {
      const query = 'SELECT dt, raw FROM logs LIMIT 10';
      const options1 = { sources: ['test1'], limit: 10 };
      const options2 = { sources: ['test2'], limit: 10 };
      
      const id1 = client.generateCacheId(query, options1);
      const id2 = client.generateCacheId(query, options2);
      
      expect(id1).not.toBe(id2);
    });

    it('should generate different cache IDs for different queries', () => {
      const query1 = 'SELECT dt, raw FROM logs LIMIT 10';
      const query2 = 'SELECT dt, raw FROM logs LIMIT 20';
      const options = { sources: ['test'], limit: 10 };
      
      const id1 = client.generateCacheId(query1, options);
      const id2 = client.generateCacheId(query2, options);
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('cacheLogResults', () => {
    it('should cache log results successfully', () => {
      const cacheId = 'test-cache-123';
      const logs: LogEntry[] = [
        { dt: '2024-01-01T10:00:00Z', raw: '{"message":"Test log 1"}' },
        { dt: '2024-01-01T10:01:00Z', raw: '{"message":"Test log 2"}' }
      ];
      const metadata = {
        sources_queried: ['test-source'],
        executed_sql: 'SELECT dt, raw FROM logs',
        request_url: 'https://test.com',
        api_used: 'clickhouse',
        total_rows: 2
      };

      // Should not throw
      expect(() => {
        client.cacheLogResults(cacheId, logs, metadata);
      }).not.toThrow();
    });

    it('should handle empty log arrays', () => {
      const cacheId = 'test-cache-empty';
      const logs: LogEntry[] = [];
      const metadata = {
        sources_queried: ['test-source'],
        executed_sql: 'SELECT dt, raw FROM logs WHERE false',
        request_url: 'https://test.com',
        api_used: 'clickhouse',
        total_rows: 0
      };

      expect(() => {
        client.cacheLogResults(cacheId, logs, metadata);
      }).not.toThrow();
    });
  });

  describe('getCachedLogDetails', () => {
    beforeEach(() => {
      // Cache some test data
      const logs: LogEntry[] = [
        { dt: '2024-01-01T10:00:00Z', raw: '{"message":"First log","level":"INFO"}' },
        { dt: '2024-01-01T10:01:00Z', raw: '{"message":"Second log","level":"WARN"}' },
        { dt: '2024-01-01T10:02:00Z', raw: '{"message":"Third log","level":"ERROR"}' }
      ];
      const metadata = {
        sources_queried: ['test-source'],
        executed_sql: 'SELECT dt, raw FROM logs',
        request_url: 'https://test.com',
        api_used: 'clickhouse',
        total_rows: 3
      };
      client.cacheLogResults('test-cache-456', logs, metadata);
    });

    it('should retrieve cached log details successfully', () => {
      const result = client.getCachedLogDetails('test-cache-456', 1);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.log.dt).toBe('2024-01-01T10:01:00Z');
        expect(result.log.raw).toBe('{"message":"Second log","level":"WARN"}');
        expect(result.metadata.sources_queried).toEqual(['test-source']);
        expect(result.metadata.total_rows).toBe(3);
      }
    });

    it('should handle invalid cache ID', () => {
      const result = client.getCachedLogDetails('non-existent-cache', 0);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Cache ID not found or expired');
      }
    });

    it('should handle invalid log index (negative)', () => {
      const result = client.getCachedLogDetails('test-cache-456', -1);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid log index: -1');
      }
    });

    it('should handle invalid log index (too high)', () => {
      const result = client.getCachedLogDetails('test-cache-456', 5);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid log index: 5');
        expect(result.error).toContain('Valid range: 0-2');
      }
    });

    it('should handle boundary log indices', () => {
      // Test first log (index 0)
      const result0 = client.getCachedLogDetails('test-cache-456', 0);
      expect(result0.success).toBe(true);
      if (result0.success) {
        expect(result0.log.raw).toBe('{"message":"First log","level":"INFO"}');
      }

      // Test last log (index 2)
      const result2 = client.getCachedLogDetails('test-cache-456', 2);
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.log.raw).toBe('{"message":"Third log","level":"ERROR"}');
      }
    });
  });

  describe('getLogCacheStats', () => {
    it('should return empty stats when no cache entries exist', () => {
      const stats = client.getLogCacheStats();
      
      expect(stats.totalCaches).toBe(0);
      expect(stats.totalLogs).toBe(0);
      expect(stats.oldestCacheAge).toBeNull();
    });

    it('should return correct stats when cache entries exist', () => {
      // Add some cache entries
      const logs1: LogEntry[] = [
        { dt: '2024-01-01T10:00:00Z', raw: '{"message":"Log 1"}' },
        { dt: '2024-01-01T10:01:00Z', raw: '{"message":"Log 2"}' }
      ];
      const logs2: LogEntry[] = [
        { dt: '2024-01-01T10:02:00Z', raw: '{"message":"Log 3"}' }
      ];
      const metadata = {
        sources_queried: ['test'],
        executed_sql: 'SELECT dt, raw FROM logs',
        request_url: 'https://test.com',
        api_used: 'clickhouse',
        total_rows: 2
      };

      client.cacheLogResults('cache-1', logs1, metadata);
      client.cacheLogResults('cache-2', logs2, metadata);

      const stats = client.getLogCacheStats();
      
      expect(stats.totalCaches).toBe(2);
      expect(stats.totalLogs).toBe(3); // 2 + 1
      expect(stats.oldestCacheAge).toBeGreaterThanOrEqual(0);
    });
  });

  // Note: Cache expiration tests would require mocking Date.now() or using fake timers
  // These could be added in a future iteration if needed
});