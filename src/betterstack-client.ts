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
  private liveTailClient: AxiosInstance;
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

    // Legacy Live Tail API client for older sources (Bearer token auth)
    this.liveTailClient = axios.create({
      baseURL: 'https://telemetry.betterstack.com',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
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
    this.liveTailClient.interceptors.response.use((response) => response, errorHandler);
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.config.cacheTtlSeconds * 1000;
  }

  private transformApiSource(apiSource: BetterstackApiSource): Source & { source_group_id?: number; table_name: string; team_id: number } {
    return {
      id: apiSource.id,
      name: apiSource.attributes.name,
      platform: apiSource.attributes.platform,
      retention_days: apiSource.attributes.logs_retention,
      created_at: apiSource.attributes.created_at,
      updated_at: apiSource.attributes.updated_at,
      source_group_id: apiSource.attributes.source_group_id,
      table_name: apiSource.attributes.table_name,
      team_id: apiSource.attributes.team_id
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
    sources: (Source & { table_name: string })[], 
    dataType: DataSourceType = 'recent'
  ): string {
    if (sources.length === 0) {
      throw new Error('No sources provided for query');
    }

    if (sources.length === 1) {
      const source = sources[0];
      const teamId = (source as any).team_id;
      const tableName = (source as any).table_name;
      
      let tableFunction: string;
      
      if (dataType === 'historical') {
        const s3TableName = `t${teamId}_${tableName}_s3`;
        tableFunction = `s3Cluster(primary, ${s3TableName})`;
      } else if (dataType === 'metrics') {
        const metricsTableName = `t${teamId}_${tableName}_metrics`;
        tableFunction = `remote(${metricsTableName})`;
      } else {
        // Recent logs
        const logsTableName = `t${teamId}_${tableName}_logs`;
        tableFunction = `remote(${logsTableName})`;
      }
      
      console.error(`Generated table function: ${tableFunction}`);
      return baseQuery.replace(/FROM\s+(logs|metrics)\b/gi, `FROM ${tableFunction}`);
    }

    // Multi-source query using UNION ALL
    const unionQueries = sources.map(source => {
      const teamId = (source as any).team_id;
      const tableName = (source as any).table_name;
      
      let tableFunction: string;
      
      if (dataType === 'historical') {
        const s3TableName = `t${teamId}_${tableName}_s3`;
        tableFunction = `s3Cluster(primary, ${s3TableName})`;
      } else if (dataType === 'metrics') {
        const metricsTableName = `t${teamId}_${tableName}_metrics`;
        tableFunction = `remote(${metricsTableName})`;
      } else {
        // Recent logs
        const logsTableName = `t${teamId}_${tableName}_logs`;
        tableFunction = `remote(${logsTableName})`;
      }
      
      const sourceQuery = baseQuery.replace(/FROM\s+(logs|metrics)\b/gi, `FROM ${tableFunction}`);
      
      // Add source identifier to SELECT clause
      if (sourceQuery.toLowerCase().includes('select')) {
        return sourceQuery.replace(
          /SELECT\s+/i, 
          `SELECT '${source.name}' as source, `
        );
      }
      
      return sourceQuery;
    });

    console.error(`Generated multi-source query with ${unionQueries.length} sources`);
    return unionQueries.join(' UNION ALL ');
  }

  async executeQuery(
    query: string, 
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const sources = await this.resolveSources(options) as (Source & { table_name: string })[];
    const dataType = options.dataType || 'recent';
    
    // Classify sources by API type based on creation date
    const { clickHouseSources, liveTailSources } = this.classifySourcesByAPI(sources);
    
    console.error(`Query classification: ${clickHouseSources.length} ClickHouse sources, ${liveTailSources.length} Live Tail sources`);
    
    // If we have both types, we need to execute against both APIs and merge results
    if (clickHouseSources.length > 0 && liveTailSources.length > 0) {
      return await this.executeDualQuery(query, clickHouseSources, liveTailSources, options);
    }
    
    // If only Live Tail sources, use Legacy API
    if (liveTailSources.length > 0 && clickHouseSources.length === 0) {
      return await this.executeLiveTailQuery(query, liveTailSources, options);
    }
    
    // If only ClickHouse sources (or empty), use new ClickHouse API
    return await this.executeClickHouseQuery(query, clickHouseSources as (Source & { table_name: string })[], dataType, options);
  }

  // Execute query against new ClickHouse API for newer sources
  private async executeClickHouseQuery(
    query: string,
    sources: (Source & { table_name: string })[],
    dataType: DataSourceType,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    console.error(`Executing ClickHouse query for ${sources.length} newer sources`);
    
    // Validate table names
    sources.forEach(source => {
      console.error(`Source: ${source.name}, Table: ${source.table_name}, Team ID: ${(source as any).team_id}`);
      if (!source.table_name || !source.table_name.match(/^t\d+_.*_logs$/)) {
        console.error(`Warning: Table name '${source.table_name}' doesn't match expected pattern 't{teamId}_{sourceId}_logs'`);
      }
    });
    
    let finalQuery = query;
    console.error(`Original query: ${query}`);
    
    // If query doesn't specify a table function, build multi-source query
    if (!query.toLowerCase().includes('remote(') && !query.toLowerCase().includes('s3cluster(')) {
      finalQuery = this.buildMultiSourceQuery(query, sources, dataType);
    }
    
    console.error(`Final query: ${finalQuery}`);

    // Add LIMIT if specified and not already present
    if (options.limit && !finalQuery.toLowerCase().includes('limit')) {
      finalQuery += ` LIMIT ${options.limit}`;
    }

    // Add FORMAT JSON if not already present
    if (!finalQuery.toLowerCase().includes('format')) {
      finalQuery += ' FORMAT JSON';
    }

    try {
      const response = await this.rateLimiter(() => 
        this.queryClient.post('/', finalQuery)
      );

      return {
        data: response.data.data || response.data || [],
        meta: {
          total_rows: response.data.rows || response.data.length,
          sources_queried: sources.map(s => s.name),
          api_used: 'clickhouse'
        }
      };
    } catch (error) {
      console.error('ClickHouse query execution failed:', error);
      throw error;
    }
  }

  // Execute query against both APIs and merge results
  private async executeDualQuery(
    query: string,
    clickHouseSources: Source[],
    liveTailSources: Source[],
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    console.error(`Executing dual query: ${clickHouseSources.length} ClickHouse + ${liveTailSources.length} Live Tail sources`);
    
    const dataType = options.dataType || 'recent';
    
    try {
      // Execute both queries in parallel
      const [clickHouseResult, liveTailResult] = await Promise.allSettled([
        this.executeClickHouseQuery(query, clickHouseSources as (Source & { table_name: string })[], dataType, options),
        this.executeLiveTailQuery(query, liveTailSources, options)
      ]);
      
      // Merge results
      const mergedData: any[] = [];
      const sourcesQueried: string[] = [];
      let totalRows = 0;
      const apisUsed: string[] = [];
      
      if (clickHouseResult.status === 'fulfilled') {
        mergedData.push(...clickHouseResult.value.data);
        if (clickHouseResult.value.meta) {
          sourcesQueried.push(...clickHouseResult.value.meta.sources_queried);
          totalRows += clickHouseResult.value.meta.total_rows || 0;
        }
        apisUsed.push('clickhouse');
      } else {
        console.error('ClickHouse query failed in dual execution:', clickHouseResult.reason);
      }
      
      if (liveTailResult.status === 'fulfilled') {
        mergedData.push(...liveTailResult.value.data);
        if (liveTailResult.value.meta) {
          sourcesQueried.push(...liveTailResult.value.meta.sources_queried);
          totalRows += liveTailResult.value.meta.total_rows || 0;
        }
        apisUsed.push('live_tail');
      } else {
        console.error('Live Tail query failed in dual execution:', liveTailResult.reason);
      }
      
      // If both failed, throw an error
      if (clickHouseResult.status === 'rejected' && liveTailResult.status === 'rejected') {
        throw new Error(`Both API queries failed. ClickHouse: ${clickHouseResult.reason}, Live Tail: ${liveTailResult.reason}`);
      }
      
      return {
        data: mergedData,
        meta: {
          total_rows: totalRows,
          sources_queried: sourcesQueried,
          api_used: apisUsed.join('+')
        }
      };
    } catch (error) {
      console.error('Dual query execution failed:', error);
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

  // Date classification utility to determine which API to use
  private shouldUseLiveTailAPI(source: Source): boolean {
    const cutoffDate = new Date('2025-02-28T23:59:59Z'); // Feb 28, 2025 cutoff
    
    if (!source.created_at) {
      // If no creation date available, assume it's an older source
      return true;
    }
    
    const sourceCreatedAt = new Date(source.created_at);
    
    // Sources created Feb 28, 2025 or earlier use Legacy Live Tail API
    // Sources created March 1, 2025 or later use new ClickHouse API
    return sourceCreatedAt <= cutoffDate;
  }

  // Classify sources by API type
  private classifySourcesByAPI(sources: Source[]): { clickHouseSources: Source[]; liveTailSources: Source[] } {
    const clickHouseSources: Source[] = [];
    const liveTailSources: Source[] = [];

    sources.forEach(source => {
      if (this.shouldUseLiveTailAPI(source)) {
        liveTailSources.push(source);
      } else {
        clickHouseSources.push(source);
      }
    });

    console.error(`Classified sources: ${clickHouseSources.length} ClickHouse, ${liveTailSources.length} Live Tail`);
    return { clickHouseSources, liveTailSources };
  }

  // Execute query against Legacy Live Tail API for older sources
  private async executeLiveTailQuery(
    query: string,
    sources: Source[],
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    console.error(`Executing Live Tail v2 query for ${sources.length} older sources`);
    
    const sourceIds = sources.map(s => s.id).join(',');
    
    try {
      // Translate ClickHouse query to Live Tail API parameters
      const queryParams = this.translateQueryForLiveTail(query, options);
      queryParams.source_ids = sourceIds;
      
      console.error(`Live Tail v2 query params: ${JSON.stringify(queryParams)}`);
      
      const response = await this.rateLimiter(() =>
        this.liveTailClient.get('/api/v2/query/live-tail', {
          params: queryParams
        })
      );
      
      const normalizedData = this.normalizeLiveTailResponse(response.data);
      
      return {
        data: normalizedData,
        meta: {
          total_rows: normalizedData.length,
          sources_queried: sources.map(s => s.name),
          api_used: 'live_tail_v2'
        }
      };
    } catch (error: any) {
      console.error('Live Tail v2 query execution failed:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  // Translate ClickHouse query to Live Tail API v2 parameters
  private translateQueryForLiveTail(query: string, options: QueryOptions): any {
    const params: any = {
      batch: Math.min(Math.max(options.limit || 100, 50), 1000), // Ensure within 50-1000 range
      order: 'newest_first' // Default to newest first
    };
    
    // Handle time range if provided
    if (options.timeRange) {
      params.from = options.timeRange.start.toISOString();
      params.to = options.timeRange.end.toISOString();
    } else {
      // Default to last 30 minutes for recent queries
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      params.from = thirtyMinutesAgo.toISOString();
      params.to = now.toISOString();
    }
    
    // Extract ORDER BY clause
    const orderMatch = query.match(/order\s+by\s+\w+\s+(asc|desc)/i);
    if (orderMatch) {
      params.order = orderMatch[1].toLowerCase() === 'asc' ? 'oldest_first' : 'newest_first';
    }
    
    // Extract WHERE clauses and convert to Live Tail Query Language
    const whereMatch = query.match(/where\s+(.+?)(?:\s+order|\s+limit|\s+format|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      
      // Extract simple string searches (LIKE patterns)
      const likeMatches = whereClause.match(/\w+\s+like\s+'([^']+)'/gi);
      if (likeMatches) {
        const searchTerms = likeMatches.map(match => {
          const termMatch = match.match(/'([^']+)'/);
          return termMatch ? termMatch[1].replace(/%/g, '') : '';
        }).filter(term => term);
        
        if (searchTerms.length > 0) {
          params.query = searchTerms.join(' ');
        }
      }
      
      // Extract exact string matches
      const exactMatches = whereClause.match(/\w+\s*=\s*'([^']+)'/gi);
      if (exactMatches && !params.query) {
        const exactTerms = exactMatches.map(match => {
          const termMatch = match.match(/'([^']+)'/);
          return termMatch ? `"${termMatch[1]}"` : '';
        }).filter(term => term);
        
        if (exactTerms.length > 0) {
          params.query = exactTerms.join(' AND ');
        }
      }
    }
    
    return params;
  }

  // Normalize Live Tail API v2 response to match ClickHouse format
  private normalizeLiveTailResponse(responseData: any): any[] {
    if (!responseData) return [];
    
    // Live Tail v2 API returns data in responseData.data array
    if (responseData.data && Array.isArray(responseData.data)) {
      return responseData.data.map((logEntry: any) => ({
        dt: logEntry.dt,
        raw: logEntry.message || JSON.stringify(logEntry),
        source: logEntry.app || logEntry.source_id,
        ...logEntry // Include all other fields from the log entry
      }));
    }
    
    // Fallback for unexpected response format
    if (Array.isArray(responseData)) {
      return responseData;
    }
    
    return [];
  }
}