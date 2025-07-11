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
  BetterstackApiError,
  BetterstackApiSource,
  BetterstackApiSourceGroup
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
      baseURL: config.clickhouseQueryEndpoint,
      auth: {
        username: config.clickhouseUsername,
        password: config.clickhousePassword
      },
      timeout: 30000,
      headers: {
        'Content-Type': 'text/plain',
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

  private transformApiSource(apiSource: BetterstackApiSource): Source & { source_group_id?: number } {
    return {
      id: apiSource.id,
      name: apiSource.attributes.name,
      platform: apiSource.attributes.platform,
      retention_days: apiSource.attributes.logs_retention,
      created_at: apiSource.attributes.created_at,
      updated_at: apiSource.attributes.updated_at,
      source_group_id: apiSource.attributes.source_group_id
    };
  }

  private transformApiSourceGroup(apiSourceGroup: BetterstackApiSourceGroup): SourceGroup {
    return {
      id: apiSourceGroup.id,
      name: apiSourceGroup.attributes.name,
      source_ids: [], // Will be populated separately by fetching sources for this group
      created_at: apiSourceGroup.attributes.created_at,
      updated_at: apiSourceGroup.attributes.updated_at,
      sort_index: apiSourceGroup.attributes.sort_index,
      team_name: apiSourceGroup.attributes.team_name
    };
  }

  private buildTableName(sourceId: string, sourceName: string, dataType: DataSourceType): string {
    const suffix = dataType === 'historical' ? '_archive' : 
                   dataType === 'metrics' ? '_metrics' : '';
    // Sanitize source name for ClickHouse table naming
    const sanitizedName = sourceName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/__+/g, '_');
    return `t${sourceId}_${sanitizedName}_logs${suffix}`;
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
        this.queryClient.post('/', 'SELECT 1 FORMAT JSON')
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
      
      const apiSources: BetterstackApiSource[] = response.data.data || [];
      const sources: Source[] = apiSources.map(apiSource => this.transformApiSource(apiSource));
      
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

    try {
      const response = await this.rateLimiter(() => 
        this.telemetryClient.get('/api/v1/source-groups', {
          params: {
            page: 1,
            per_page: 50
          }
        })
      );
      
      const apiSourceGroups: BetterstackApiSourceGroup[] = response.data.data || [];
      const sourceGroups: SourceGroup[] = apiSourceGroups.map(apiGroup => this.transformApiSourceGroup(apiGroup));
      
      // Populate source_ids for each group by fetching sources and filtering by source_group_id
      const allSources = await this.listSources() as (Source & { source_group_id?: number })[];
      sourceGroups.forEach(group => {
        const groupIdNum = parseInt(group.id);
        group.source_ids = allSources
          .filter(source => source.source_group_id === groupIdNum)
          .map(source => source.id);
      });
      
      this.sourceGroupsCache = { data: sourceGroups, timestamp: Date.now() };
      console.error(`Successfully fetched ${sourceGroups.length} source groups from Betterstack API`);
      return sourceGroups;
    } catch (error: any) {
      if (error.response?.data?.errors?.includes('Invalid Team API token')) {
        console.error('Source groups require a Team API token. Please ensure you\'re using a Team API token from the Telemetry API tokens section in your Betterstack settings.');
      } else {
        console.error('Unable to fetch source groups from API:', error);
      }
      this.sourceGroupsCache = { data: [], timestamp: Date.now() };
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
    
    // Convert query to use Betterstack template variables
    let finalQuery = query;
    
    // Replace generic table references with {{source}} template
    finalQuery = finalQuery.replace(/FROM\s+logs\b/gi, 'FROM {{source}}');
    finalQuery = finalQuery.replace(/FROM\s+metrics\b/gi, 'FROM {{source}}');
    
    // Add time filtering if not present and query references time
    if (!finalQuery.toLowerCase().includes('time between') && 
        !finalQuery.toLowerCase().includes('{{start_time}}') &&
        finalQuery.toLowerCase().includes('dt >=')) {
      // Replace dt >= now() - INTERVAL patterns with Betterstack time variables
      finalQuery = finalQuery.replace(
        /dt\s*>=\s*now\(\)\s*-\s*INTERVAL\s+\d+\s+(MINUTE|HOUR|DAY)/gi,
        'time BETWEEN {{start_time}} AND {{end_time}}'
      );
      finalQuery = finalQuery.replace(/dt\b/g, 'time');
    }

    try {
      // Use Explore Query API for querying logs
      const sourceIds = sources.map(s => s.id);
      
      const response = await this.rateLimiter(() => 
        this.telemetryClient.get('/api/v2/query/explore-logs', {
          params: {
            source_ids: sourceIds.join(','),
            query: finalQuery,
            limit: options.limit || 100
          }
        })
      );

      return {
        data: response.data.data || response.data || [],
        meta: {
          total_rows: response.data.rows || (response.data.data || []).length,
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