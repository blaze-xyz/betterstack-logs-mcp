import { describe, it, expect, beforeEach } from 'vitest'
import { BetterstackClient } from '../../../src/betterstack-client.js'
import { createTestConfig } from '../../helpers/test-config.js'
import { Source, DataSourceType } from '../../../src/types.js'

describe('buildMultiSourceQuery Function', () => {
  let client: BetterstackClient

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig())
  })

  // Mock sources with team_id and table_name properties
  const mockSources = [
    {
      id: '1021716',
      name: 'Production API Server',
      platform: 'ubuntu',
      table_name: 'prod_api',
      team_id: 298009
    },
    {
      id: '1021717',
      name: 'Frontend Application',
      platform: 'docker',
      table_name: 'frontend_app',
      team_id: 298009
    }
  ] as (Source & { table_name: string })[]

  const singleSource = [mockSources[0]]

  describe('Single Source Queries', () => {
    it('should generate union query for single source with dataType=union', () => {
      const baseQuery = 'SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 1 HOUR ORDER BY dt DESC LIMIT 10'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'union')
      
      const expectedTableFunction = '(SELECT dt, raw FROM remote(t298009_prod_api_logs) UNION ALL SELECT dt, raw FROM s3Cluster(primary, t298009_prod_api_s3) WHERE _row_type = 1)'
      const expectedQuery = `SELECT dt, raw FROM ${expectedTableFunction} WHERE dt >= now() - INTERVAL 1 HOUR ORDER BY dt DESC LIMIT 10`
      
      expect(result).toBe(expectedQuery)
    })

    it('should generate recent query for single source with dataType=recent', () => {
      const baseQuery = 'SELECT dt, raw FROM logs WHERE level = "ERROR" LIMIT 50'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'recent')
      
      const expectedQuery = 'SELECT dt, raw FROM remote(t298009_prod_api_logs) WHERE level = "ERROR" LIMIT 50'
      expect(result).toBe(expectedQuery)
    })

    it('should generate historical query for single source with dataType=historical', () => {
      const baseQuery = 'SELECT dt, raw FROM logs WHERE dt >= "2024-01-01" LIMIT 100'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'historical')
      
      const expectedQuery = 'SELECT dt, raw FROM s3Cluster(primary, t298009_prod_api_s3, filename=\'{{_s3_glob_interpolate}}\') WHERE dt >= "2024-01-01" LIMIT 100'
      expect(result).toBe(expectedQuery)
    })

    it('should generate metrics query for single source with dataType=metrics', () => {
      const baseQuery = 'SELECT dt, metric_name, value FROM metrics ORDER BY dt DESC LIMIT 20'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'metrics')
      
      const expectedQuery = 'SELECT dt, metric_name, value FROM remote(t298009_prod_api_metrics) ORDER BY dt DESC LIMIT 20'
      expect(result).toBe(expectedQuery)
    })
  })

  describe('Multi-Source Queries', () => {
    it('should generate unified UNION ALL subquery for multiple sources with dataType=union', () => {
      const baseQuery = 'SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 2 HOURS ORDER BY dt DESC LIMIT 25'
      const result = client.buildMultiSourceQuery(baseQuery, mockSources, 'union')
      
      // Should generate unified subquery following BetterStack's documented structure
      const expectedSubquery = `(SELECT 'Production API Server' as source, dt, raw FROM remote(t298009_prod_api_logs) UNION ALL SELECT 'Production API Server' as source, dt, raw FROM s3Cluster(primary, t298009_prod_api_s3) WHERE _row_type = 1 UNION ALL SELECT 'Frontend Application' as source, dt, raw FROM remote(t298009_frontend_app_logs) UNION ALL SELECT 'Frontend Application' as source, dt, raw FROM s3Cluster(primary, t298009_frontend_app_s3) WHERE _row_type = 1)`
      const expectedQuery = `SELECT source, dt, raw FROM ${expectedSubquery} WHERE dt >= now() - INTERVAL 2 HOURS ORDER BY dt DESC LIMIT 25`
      
      expect(result).toBe(expectedQuery)
    })

    it('should generate unified UNION ALL subquery for multiple sources with dataType=recent', () => {
      const baseQuery = 'SELECT dt, raw FROM logs WHERE raw LIKE "%error%" LIMIT 10'
      const result = client.buildMultiSourceQuery(baseQuery, mockSources, 'recent')
      
      // Should generate unified subquery with only remote tables
      const expectedSubquery = `(SELECT 'Production API Server' as source, dt, raw FROM remote(t298009_prod_api_logs) UNION ALL SELECT 'Frontend Application' as source, dt, raw FROM remote(t298009_frontend_app_logs))`
      const expectedQuery = `SELECT source, dt, raw FROM ${expectedSubquery} WHERE raw LIKE "%error%" LIMIT 10`
      
      expect(result).toBe(expectedQuery)
    })

    it('should generate unified UNION ALL subquery for multiple sources with dataType=historical', () => {
      const baseQuery = 'SELECT dt, raw FROM logs WHERE dt >= "2024-01-01" AND dt <= "2024-01-02" LIMIT 15'
      const result = client.buildMultiSourceQuery(baseQuery, mockSources, 'historical')
      
      // Should generate unified subquery with only s3Cluster tables
      const expectedSubquery = `(SELECT 'Production API Server' as source, dt, raw FROM s3Cluster(primary, t298009_prod_api_s3, filename='{{_s3_glob_interpolate}}') WHERE _row_type = 1 UNION ALL SELECT 'Frontend Application' as source, dt, raw FROM s3Cluster(primary, t298009_frontend_app_s3, filename='{{_s3_glob_interpolate}}') WHERE _row_type = 1)`
      const expectedQuery = `SELECT source, dt, raw FROM ${expectedSubquery} WHERE dt >= "2024-01-01" AND dt <= "2024-01-02" LIMIT 15`
      
      expect(result).toBe(expectedQuery)
    })

    it('should generate unified UNION ALL subquery for multiple sources with dataType=metrics', () => {
      const baseQuery = 'SELECT dt, metric_name, value FROM metrics WHERE metric_name = "cpu_usage" LIMIT 30'
      const result = client.buildMultiSourceQuery(baseQuery, mockSources, 'metrics')
      
      // Metrics queries don't typically need source identification, but the structure should still be unified
      const expectedSubquery = `(SELECT dt, raw FROM remote(t298009_prod_api_metrics) UNION ALL SELECT dt, raw FROM remote(t298009_frontend_app_metrics))`
      const expectedQuery = `SELECT dt, metric_name, value FROM ${expectedSubquery} WHERE metric_name = "cpu_usage" LIMIT 30`
      
      expect(result).toBe(expectedQuery)
    })
  })

  describe('Table Name Replacement', () => {
    it('should replace "logs" table name in FROM clause', () => {
      const baseQuery = 'SELECT dt, raw FROM logs ORDER BY dt DESC'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'recent')
      
      expect(result).toBe('SELECT dt, raw FROM remote(t298009_prod_api_logs) ORDER BY dt DESC')
    })

    it('should replace "metrics" table name in FROM clause', () => {
      const baseQuery = 'SELECT dt, metric_name, value FROM metrics WHERE dt >= now() - INTERVAL 1 DAY'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'metrics')
      
      expect(result).toBe('SELECT dt, metric_name, value FROM remote(t298009_prod_api_metrics) WHERE dt >= now() - INTERVAL 1 DAY')
    })

    it('should replace "union_subquery" table name in FROM clause', () => {
      const baseQuery = 'SELECT dt, raw FROM union_subquery WHERE level = "INFO"'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'union')
      
      const expectedTableFunction = '(SELECT dt, raw FROM remote(t298009_prod_api_logs) UNION ALL SELECT dt, raw FROM s3Cluster(primary, t298009_prod_api_s3) WHERE _row_type = 1)'
      const expectedQuery = `SELECT dt, raw FROM ${expectedTableFunction} WHERE level = "INFO"`
      
      expect(result).toBe(expectedQuery)
    })

    it('should handle case-insensitive FROM clause replacement', () => {
      const baseQuery = 'select dt, raw from LOGS where dt >= now() - interval 1 hour'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'recent')
      
      // The replacement preserves the case of everything except the replaced part
      expect(result).toBe('select dt, raw FROM remote(t298009_prod_api_logs) where dt >= now() - interval 1 hour')
    })
  })

  describe('Source Identifier Addition', () => {
    it('should add source identifier within unified subquery for multi-source queries', () => {
      const baseQuery = 'SELECT dt, raw FROM logs LIMIT 5'
      const result = client.buildMultiSourceQuery(baseQuery, mockSources, 'recent')
      
      // Source identifiers should be within the subquery, not in outer SELECT
      expect(result).toContain(`SELECT 'Production API Server' as source, dt, raw FROM remote`)
      expect(result).toContain(`SELECT 'Frontend Application' as source, dt, raw FROM remote`)
      // Outer SELECT should include source column
      expect(result).toMatch(/^SELECT source, dt, raw FROM \(/)
    })

    it('should not add source identifier to single-source queries', () => {
      const baseQuery = 'SELECT dt, raw FROM logs LIMIT 5'
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'recent')
      
      expect(result).not.toContain('as source')
      expect(result).toBe('SELECT dt, raw FROM remote(t298009_prod_api_logs) LIMIT 5')
    })
  })

  describe('Edge Cases', () => {
    it('should throw error when no sources provided', () => {
      const baseQuery = 'SELECT dt, raw FROM logs LIMIT 10'
      
      expect(() => {
        client.buildMultiSourceQuery(baseQuery, [], 'recent')
      }).toThrow('No sources provided for query')
    })

    it('should handle complex queries with multiple clauses', () => {
      const baseQuery = `
        SELECT dt, raw 
        FROM logs 
        WHERE dt >= now() - INTERVAL 6 HOURS 
          AND ilike(raw, '%error%') 
          AND ilike(raw, '%"level":"error"%') 
        ORDER BY dt DESC 
        LIMIT 50
      `.trim()
      
      const result = client.buildMultiSourceQuery(baseQuery, singleSource, 'union')
      
      const expectedTableFunction = '(SELECT dt, raw FROM remote(t298009_prod_api_logs) UNION ALL SELECT dt, raw FROM s3Cluster(primary, t298009_prod_api_s3) WHERE _row_type = 1)'
      
      expect(result).toContain(expectedTableFunction)
      expect(result).toContain('WHERE dt >= now() - INTERVAL 6 HOURS')
      expect(result).toContain(`AND ilike(raw, '%error%')`)
      expect(result).toContain('ORDER BY dt DESC')
      expect(result).toContain('LIMIT 50')
    })

    it('should handle queries with different team IDs', () => {
      const sourcesWithDifferentTeams = [
        {
          id: '1021716',
          name: 'Team A Source',
          table_name: 'team_a',
          team_id: 111111
        },
        {
          id: '1021717', 
          name: 'Team B Source',
          table_name: 'team_b',
          team_id: 222222
        }
      ] as (Source & { table_name: string })[]

      const baseQuery = 'SELECT dt, raw FROM logs WHERE level = "ERROR" LIMIT 20'
      const result = client.buildMultiSourceQuery(baseQuery, sourcesWithDifferentTeams, 'recent')
      
      // Should generate unified subquery with both team tables
      expect(result).toContain('remote(t111111_team_a_logs)')
      expect(result).toContain('remote(t222222_team_b_logs)')
      expect(result).toContain('UNION ALL')
      // Should have unified structure
      expect(result).toMatch(/^SELECT source, dt, raw FROM \(/)
    })
  })

  describe('UNION ALL Structure Validation', () => {
    it('should generate proper UNION ALL structure for union dataType', () => {
      const baseQuery = 'SELECT dt, raw FROM logs WHERE dt >= now() - INTERVAL 24 HOURS LIMIT 100'
      const result = client.buildMultiSourceQuery(baseQuery, mockSources, 'union')
      
      // Should contain multiple UNION ALL clauses
      const unionAllCount = (result.match(/UNION ALL/g) || []).length
      expect(unionAllCount).toBeGreaterThan(0)
      
      // Should contain both remote() and s3Cluster() for each source
      expect(result).toContain('remote(t298009_prod_api_logs)')
      expect(result).toContain('s3Cluster(primary, t298009_prod_api_s3)')
      expect(result).toContain('remote(t298009_frontend_app_logs)')
      expect(result).toContain('s3Cluster(primary, t298009_frontend_app_s3)')
      
      // Should contain _row_type = 1 filters for s3Cluster queries
      const rowTypeCount = (result.match(/_row_type = 1/g) || []).length
      expect(rowTypeCount).toBe(2) // One for each source
    })

    it('should generate unified UNION ALL subquery for non-union dataTypes', () => {
      const baseQuery = 'SELECT dt, raw FROM logs LIMIT 10'
      const result = client.buildMultiSourceQuery(baseQuery, mockSources, 'recent')
      
      // Should have exactly one UNION ALL in the unified subquery
      const unionAllCount = (result.match(/UNION ALL/g) || []).length
      expect(unionAllCount).toBe(1)
      
      // Should contain source identifiers within the subquery
      expect(result).toContain(`'Production API Server' as source`)
      expect(result).toContain(`'Frontend Application' as source`)
      
      // Should have unified structure
      expect(result).toMatch(/^SELECT source, dt, raw FROM \(/)
    })
  })
})