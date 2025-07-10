import axios, { AxiosInstance, AxiosResponse } from 'axios';
import pLimit from 'p-limit';
import { BetterstackConfig } from './config.js';
import { 
  Source, 
  SourceGroup, 
  SourceGroupInfo, 
  QueryResult, 
  QueryOptions, 
  DataSourceType,
  BetterstackApiError 
} from './types.js';

export class BetterstackClient {
  private telemetryClient: AxiosInstance;
  private queryClient: AxiosInstance;
  private sourcesCache: { data: Source[]; timestamp: number } | null = null;
  private sourceGroupsCache: { data: SourceGroup[]; timestamp: number } | null = null;
  private config: BetterstackConfig;
  private rateLimiter = pLimit(5); // Max 5 concurrent requests

  constructor(config: BetterstackConfig) {
    this.config = config;
    
    // Telemetry API client for source management (Bearer token auth)
    this.telemetryClient = axios.create({
      baseURL: config.telemetryEndpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`,
        'User-Agent': 'betterstack-logs-mcp/1.0.0'
      }
    });

    // ClickHouse Query client for log operations (basic auth)
    this.queryClient = axios.create({
      baseURL: config.queryEndpoint,
      auth: {
        username: config.clickhouseUsername,
        password: config.clickhousePassword
      },
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'betterstack-logs-mcp/1.0.0'
      }
    });

    // Add response interceptor for error handling
    const errorHandler = (error: any) => {
      if (error.response) {
        const apiError: BetterstackApiError = {
          code: error.response.status.toString(),
          message: error.response.data?.message || error.message,
          details: error.response.data
        };
        console.error(`Betterstack API Error: ${apiError.code} - ${apiError.message}`, apiError.details);
        throw apiError;
      }
      console.error('Betterstack API Network Error:', error.message);
      throw error;
    };

    this.telemetryClient.interceptors.response.use((response) => response, errorHandler);
    this.queryClient.interceptors.response.use((response) => response, errorHandler);
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.config.cacheTtlSeconds * 1000;
  }

  private buildTableName(sourceId: string, sourceName: string, dataType: DataSourceType): string {
    const suffix = dataType === 'historical' ? '_archive' : 
                   dataType === 'metrics' ? '_metrics' : '';
    return `t${sourceId}_${sourceName}_logs${suffix}`;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test both authentication systems
      const [telemetryTest, clickhouseTest] = await Promise.allSettled([
        // Test Telemetry API (Bearer token)
        this.telemetryClient.get('/api/v1/sources', {
          params: { page: 1, per_page: 1 }
        }),
        // Test ClickHouse (basic auth)
        this.queryClient.post('/', {
          query: 'SELECT 1',
          format: 'JSON'
        })
      ]);

      const telemetrySuccess = telemetryTest.status === 'fulfilled';
      const clickhouseSuccess = clickhouseTest.status === 'fulfilled';

      if (telemetrySuccess && clickhouseSuccess) {
        console.error('✅ Both Telemetry API and ClickHouse connections successful');
        return true;
      } else {
        if (!telemetrySuccess) {
          console.error('❌ Telemetry API connection failed:', telemetryTest.reason);
        }
        if (!clickhouseSuccess) {
          console.error('❌ ClickHouse connection failed:', clickhouseTest.reason);
        }
        return false;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async listSources(): Promise<Source[]> {
    if (this.sourcesCache && this.isCacheValid(this.sourcesCache.timestamp)) {
      return this.sourcesCache.data;
    }

    try {
      const response = await this.rateLimiter(() => 
        this.telemetryClient.get('/api/v1/sources', {
          params: {
            page: 1,
            per_page: 50
          }
        })
      );
      
      const sources: Source[] = response.data.data || [];
      this.sourcesCache = { data: sources, timestamp: Date.now() };
      console.error(`Successfully fetched ${sources.length} sources from Betterstack API`);
      return sources;
    } catch (error) {
      console.error('Unable to fetch sources from API:', error);
      return [];
    }
  }

  async getSourceInfo(sourceId: string): Promise<Source | null> {
    const sources = await this.listSources();
    return sources.find(s => s.id === sourceId) || null;
  }

  async listSourceGroups(): Promise<SourceGroup[]> {
    if (this.sourceGroupsCache && this.isCacheValid(this.sourceGroupsCache.timestamp)) {
      return this.sourceGroupsCache.data;
    }

    // Note: Betterstack doesn't have a dedicated source groups API
    // Source groups are logical collections we can create from source metadata
    // For now, return empty array and let users configure groups in environment
    console.error('Source groups are not supported by Betterstack API - using environment configuration');
    this.sourceGroupsCache = { data: [], timestamp: Date.now() };
    return [];
  }

  async getSourceGroupInfo(groupName: string): Promise<SourceGroupInfo | null> {
    const groups = await this.listSourceGroups();
    const group = groups.find(g => g.name === groupName);
    
    if (!group) return null;

    const sources = await this.listSources();
    const groupSources = sources.filter(s => group.source_ids.includes(s.id));

    return {
      ...group,
      sources: groupSources,
      total_sources: groupSources.length,
      aggregate_retention_days: groupSources.length > 0 ? 
        Math.min(...groupSources.map(s => s.retention_days || 30)) : undefined
    };
  }

  private buildMultiSourceQuery(
    baseQuery: string, 
    sources: Source[], 
    dataType: DataSourceType = 'recent'
  ): string {
    if (sources.length === 0) {
      throw new Error('No sources provided for query');
    }

    if (sources.length === 1) {
      const tableName = this.buildTableName(sources[0].id, sources[0].name, dataType);
      return baseQuery.replace(/FROM\s+\w+/i, `FROM remote(${tableName})`);
    }

    // Multi-source query using UNION ALL
    const unionQueries = sources.map(source => {
      const tableName = this.buildTableName(source.id, source.name, dataType);
      const sourceQuery = baseQuery.replace(/FROM\s+\w+/i, `FROM remote(${tableName})`);
      
      // Add source identifier to SELECT clause
      if (sourceQuery.toLowerCase().includes('select')) {
        return sourceQuery.replace(
          /SELECT\s+/i, 
          `SELECT '${source.name}' as source, `
        );
      }
      
      return sourceQuery;
    });

    return unionQueries.join(' UNION ALL ');
  }

  async executeQuery(
    query: string, 
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const sources = await this.resolveSources(options);
    const dataType = options.dataType || 'recent';
    
    let finalQuery = query;
    
    // If query doesn't specify a table, build multi-source query
    if (!query.toLowerCase().includes('remote(')) {
      finalQuery = this.buildMultiSourceQuery(query, sources, dataType);
    }

    // Add LIMIT if specified and not already present
    if (options.limit && !finalQuery.toLowerCase().includes('limit')) {
      finalQuery += ` LIMIT ${options.limit}`;
    }

    try {
      const response = await this.rateLimiter(() => 
        this.queryClient.post('/', {
          query: finalQuery,
          format: 'JSON'
        })
      );

      return {
        data: response.data.data || response.data || [],
        meta: {
          total_rows: response.data.rows || response.data.length,
          sources_queried: sources.map(s => s.name)
        }
      };
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  private async resolveSources(options: QueryOptions): Promise<Source[]> {
    if (options.sources && options.sources.length > 0) {
      const allSources = await this.listSources();
      return allSources.filter(s => 
        options.sources!.includes(s.id) || options.sources!.includes(s.name)
      );
    }

    if (options.sourceGroup) {
      const groupInfo = await this.getSourceGroupInfo(options.sourceGroup);
      return groupInfo?.sources || [];
    }

    // Use default configuration
    if (this.config.defaultSourceGroup) {
      const groupInfo = await this.getSourceGroupInfo(this.config.defaultSourceGroup);
      if (groupInfo?.sources.length) {
        return groupInfo.sources;
      }
    }

    if (this.config.defaultSources && this.config.defaultSources.length > 0) {
      const allSources = await this.listSources();
      return allSources.filter(s => 
        this.config.defaultSources!.includes(s.id) || 
        this.config.defaultSources!.includes(s.name)
      );
    }

    // Fallback: use all available sources
    const allSources = await this.listSources();
    if (allSources.length === 0) {
      throw new Error('No sources available and none configured as default');
    }
    
    return allSources;
  }

  // Helper method to determine time-based data source selection
  determineDataSource(timeRange?: { start: Date; end: Date }): DataSourceType {
    if (!timeRange) return 'recent';

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // If query is asking for data older than 24 hours, use historical
    if (timeRange.end < dayAgo) {
      return 'historical';
    }
    
    return 'recent';
  }
}