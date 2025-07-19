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
import fs from 'fs';
import path from 'path';

// Setup logging
const logFile = path.join(process.cwd(), 'mcp-debug.log');
const logToFile = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] CLIENT ${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  fs.appendFileSync(logFile, logEntry);
  console.error(`CLIENT ${level}: ${message}`, data || '');
};

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
      logToFile('INFO', 'Testing connection to Betterstack APIs...');
      
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
      
      logToFile('INFO', 'Connection test results', {
        telemetrySuccess,
        clickhouseSuccess,
        telemetryError: telemetryTest.status === 'rejected' ? telemetryTest.reason?.message : null,
        clickhouseError: clickhouseTest.status === 'rejected' ? clickhouseTest.reason?.message : null
      });

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
    logToFile('INFO', 'Executing query', { query: query.trim(), options });
    
    try {
      const sources = await this.resolveSources(options) as (Source & { table_name: string })[];
      const dataType = options.dataType || 'recent';
      
      logToFile('INFO', 'Query execution parameters', { 
        sourcesCount: sources.length, 
        dataType,
        sources: sources.map(s => ({ id: s.id, name: s.name, table_name: s.table_name }))
      });
      
      // All sources now use ClickHouse API
      return await this.executeClickHouseQuery(query, sources, dataType, options);
    } catch (error: any) {
      logToFile('ERROR', 'Query execution failed', { 
        error: error?.message || error?.toString(),
        stack: error?.stack
      });
      throw error;
    }
  }

  // Execute query against ClickHouse API
  private async executeClickHouseQuery(
    query: string,
    sources: (Source & { table_name: string })[],
    dataType: DataSourceType,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    logToFile('INFO', 'Executing ClickHouse query', { 
      sourcesCount: sources.length, 
      dataType, 
      originalQuery: query.trim() 
    });
    
    // Validate table names
    const sourceDetails = sources.map(source => {
      const isValidTable = source.table_name && source.table_name.match(/^t\d+_.*_logs$/);
      return {
        name: source.name,
        table_name: source.table_name,
        team_id: (source as any).team_id,
        valid_table: isValidTable
      };
    });
    
    logToFile('INFO', 'Source validation results', sourceDetails);
    
    let finalQuery = query;
    
    // If query doesn't specify a table function, build multi-source query
    if (!query.toLowerCase().includes('remote(') && !query.toLowerCase().includes('s3cluster(')) {
      finalQuery = this.buildMultiSourceQuery(query, sources, dataType);
    }
    
    logToFile('INFO', 'Final ClickHouse query prepared', { finalQuery: finalQuery.trim() });

    // Add LIMIT if specified and not already present
    if (options.limit && !finalQuery.toLowerCase().includes('limit')) {
      finalQuery += ` LIMIT ${options.limit}`;
    }

    // Add FORMAT JSON if not already present
    if (!finalQuery.toLowerCase().includes('format')) {
      finalQuery += ' FORMAT JSON';
    }

    try {
      logToFile('INFO', 'Making ClickHouse API request', { 
        query: finalQuery.substring(0, 500) + (finalQuery.length > 500 ? '...' : ''),
        endpoint: this.config.clickhouseQueryEndpoint,
        username: this.config.clickhouseUsername
      });
      
      const response = await this.rateLimiter(() => 
        this.queryClient.post('/', finalQuery)
      );

      logToFile('INFO', 'ClickHouse API response received', {
        status: response.status,
        dataLength: response.data?.data?.length || response.data?.length || 0,
        responseDataKeys: Object.keys(response.data || {}),
        firstFewChars: JSON.stringify(response.data).substring(0, 200)
      });

      return {
        data: response.data.data || response.data || [],
        meta: {
          total_rows: response.data.rows || response.data.length,
          sources_queried: sources.map(s => s.name),
          api_used: 'clickhouse'
        }
      };
    } catch (error: any) {
      logToFile('ERROR', 'ClickHouse query execution failed', {
        error: error?.message || error?.toString(),
        response: error?.response?.data,
        status: error?.response?.status,
        config: {
          method: error?.config?.method,
          url: error?.config?.url,
          headers: error?.config?.headers,
          data: error?.config?.data?.substring(0, 200)
        },
        stack: error?.stack
      });
      console.error('ClickHouse query execution failed:', error);
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