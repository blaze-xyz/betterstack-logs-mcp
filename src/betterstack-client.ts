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
  private httpClient: AxiosInstance;
  private sourcesCache: { data: Source[]; timestamp: number } | null = null;
  private sourceGroupsCache: { data: SourceGroup[]; timestamp: number } | null = null;
  private config: BetterstackConfig;
  private rateLimiter = pLimit(5); // Max 5 concurrent requests

  constructor(config: BetterstackConfig) {
    this.config = config;
    this.httpClient = axios.create({
      baseURL: config.endpoint,
      auth: {
        username: config.username,
        password: config.password
      },
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'betterstack-logs-mcp/1.0.0'
      }
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const apiError: BetterstackApiError = {
            code: error.response.status.toString(),
            message: error.response.data?.message || error.message,
            details: error.response.data
          };
          throw apiError;
        }
        throw error;
      }
    );
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
      // Try a simple query to test connectivity
      await this.executeQuery('SELECT 1', { limit: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }

  async listSources(): Promise<Source[]> {
    if (this.sourcesCache && this.isCacheValid(this.sourcesCache.timestamp)) {
      return this.sourcesCache.data;
    }

    try {
      const response = await this.rateLimiter(() => 
        this.httpClient.get('/logs/sources')
      );
      
      const sources: Source[] = response.data.data || response.data || [];
      this.sourcesCache = { data: sources, timestamp: Date.now() };
      return sources;
    } catch (error) {
      // If API endpoint doesn't exist, return empty array
      // This will be populated when we can introspect the database
      console.error('Unable to fetch sources from API, using empty list');
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

    try {
      const response = await this.rateLimiter(() => 
        this.httpClient.get('/logs/source-groups')
      );
      
      const groups: SourceGroup[] = response.data.data || response.data || [];
      this.sourceGroupsCache = { data: groups, timestamp: Date.now() };
      return groups;
    } catch (error) {
      // If API endpoint doesn't exist, return empty array
      console.error('Unable to fetch source groups from API, using empty list');
      return [];
    }
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
        this.httpClient.post('/', {
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