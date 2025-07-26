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
import { fileURLToPath } from 'url';

// Setup logging - use the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = path.join(path.dirname(__dirname), 'mcp-debug.log');
const logToFile = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] CLIENT ${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  fs.appendFileSync(logFile, logEntry);
  console.error(`CLIENT ${level}: ${message}`, data || '');
};
const RATE_LIMIT = 1;

export class BetterstackClient {
  private telemetryClient: AxiosInstance;
  private queryClient: AxiosInstance;
  private sourcesCache: { data: Source[]; timestamp: number } | null = null;
  private sourceGroupsCache: { data: SourceGroup[]; timestamp: number } | null = null;
  private config: BetterstackConfig;
  private static rateLimiter = pLimit(RATE_LIMIT); // All instances share the same rate limiter

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
      logToFile('INFO', 'Testing connection to Betterstack APIs...', {
        telemetryEndpoint: this.config.telemetryEndpoint,
        clickhouseEndpoint: this.config.clickhouseQueryEndpoint,
        clickhouseUsername: this.config.clickhouseUsername
      });
      
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
      
      // Log detailed results for debugging
      if (telemetryTest.status === 'fulfilled') {
        logToFile('DEBUG', 'Telemetry API test successful', {
          status: telemetryTest.value.status,
          dataReceived: !!telemetryTest.value.data,
          endpoint: this.config.telemetryEndpoint
        });
      } else {
        logToFile('ERROR', 'Telemetry API test failed', {
          error: telemetryTest.reason?.message,
          response: telemetryTest.reason?.response?.data,
          status: telemetryTest.reason?.response?.status,
          endpoint: this.config.telemetryEndpoint
        });
      }

      if (clickhouseTest.status === 'fulfilled') {
        logToFile('DEBUG', 'ClickHouse test successful', {
          status: clickhouseTest.value.status,
          dataReceived: !!clickhouseTest.value.data,
          endpoint: this.config.clickhouseQueryEndpoint,
          username: this.config.clickhouseUsername
        });
      } else {
        logToFile('ERROR', 'ClickHouse test failed', {
          error: clickhouseTest.reason?.message,
          response: clickhouseTest.reason?.response?.data,
          status: clickhouseTest.reason?.response?.status,
          endpoint: this.config.clickhouseQueryEndpoint,
          username: this.config.clickhouseUsername
        });
      }
      
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
      logToFile('ERROR', 'Connection test exception', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async listSources(): Promise<Source[]> {
    if (this.sourcesCache && this.isCacheValid(this.sourcesCache.timestamp)) {
      logToFile('DEBUG', 'Using cached sources', { 
        sourceCount: this.sourcesCache.data.length,
        cacheAge: Date.now() - this.sourcesCache.timestamp
      });
      return this.sourcesCache.data;
    }

    try {
      logToFile('INFO', 'Fetching sources from Telemetry API...');
      const response = await BetterstackClient.rateLimiter(() => 
        this.telemetryClient.get('/api/v1/sources', {
          params: {
            page: 1,
            per_page: 50
          }
        })
      );
      
      const apiSources: BetterstackApiSource[] = response.data.data || [];
      logToFile('DEBUG', 'Raw API sources received', { 
        sourceCount: apiSources.length,
        sampleSource: apiSources[0] ? {
          id: apiSources[0].id,
          name: apiSources[0].attributes.name,
          table_name: apiSources[0].attributes.table_name,
          team_id: apiSources[0].attributes.team_id,
          platform: apiSources[0].attributes.platform
        } : null
      });
      
      const sources: Source[] = apiSources.map(apiSource => this.transformApiSource(apiSource));
      
      logToFile('DEBUG', 'Transformed sources', { 
        sources: sources.map(s => ({
          id: s.id,
          name: s.name,
          table_name: (s as any).table_name,
          team_id: (s as any).team_id
        }))
      });
      
      this.sourcesCache = { data: sources, timestamp: Date.now() };
      console.error(`Successfully fetched ${sources.length} sources from Betterstack API`);
      return sources;
    } catch (error) {
      logToFile('ERROR', 'Failed to fetch sources from API', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
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
      const response = await BetterstackClient.rateLimiter(() => 
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
    logToFile('DEBUG', 'Building multi-source query', { 
      baseQuery, 
      sourceCount: sources.length, 
      dataType,
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        table_name: s.table_name,
        team_id: (s as any).team_id
      }))
    });

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
        logToFile('DEBUG', 'Single source historical query', { 
          source: source.name, 
          teamId, 
          tableName, 
          s3TableName, 
          tableFunction 
        });
      } else if (dataType === 'metrics') {
        const metricsTableName = `t${teamId}_${tableName}_metrics`;
        tableFunction = `remote(${metricsTableName})`;
        logToFile('DEBUG', 'Single source metrics query', { 
          source: source.name, 
          teamId, 
          tableName, 
          metricsTableName, 
          tableFunction 
        });
      } else {
        // Recent logs
        const logsTableName = `t${teamId}_${tableName}_logs`;
        tableFunction = `remote(${logsTableName})`;
        logToFile('DEBUG', 'Single source recent logs query', { 
          source: source.name, 
          teamId, 
          tableName, 
          logsTableName, 
          tableFunction 
        });
      }
      
      const finalQuery = baseQuery.replace(/FROM\s+(logs|metrics)\b/gi, `FROM ${tableFunction}`);
      logToFile('INFO', 'Generated single-source query', { tableFunction, finalQuery });
      console.error(`Generated table function: ${tableFunction}`);
      return finalQuery;
    }

    // Multi-source query using UNION ALL
    const unionQueries = sources.map((source, index) => {
      const teamId = (source as any).team_id;
      const tableName = (source as any).table_name;
      
      let tableFunction: string;
      
      if (dataType === 'historical') {
        const s3TableName = `t${teamId}_${tableName}_s3`;
        tableFunction = `s3Cluster(primary, ${s3TableName})`;
        logToFile('DEBUG', `Multi-source historical query ${index + 1}`, { 
          source: source.name, 
          teamId, 
          tableName, 
          s3TableName, 
          tableFunction 
        });
      } else if (dataType === 'metrics') {
        const metricsTableName = `t${teamId}_${tableName}_metrics`;
        tableFunction = `remote(${metricsTableName})`;
        logToFile('DEBUG', `Multi-source metrics query ${index + 1}`, { 
          source: source.name, 
          teamId, 
          tableName, 
          metricsTableName, 
          tableFunction 
        });
      } else {
        // Recent logs
        const logsTableName = `t${teamId}_${tableName}_logs`;
        tableFunction = `remote(${logsTableName})`;
        logToFile('DEBUG', `Multi-source recent logs query ${index + 1}`, { 
          source: source.name, 
          teamId, 
          tableName, 
          logsTableName, 
          tableFunction 
        });
      }
      
      const sourceQuery = baseQuery.replace(/FROM\s+(logs|metrics)\b/gi, `FROM ${tableFunction}`);
      
      // Add source identifier to SELECT clause
      if (sourceQuery.toLowerCase().includes('select')) {
        const finalSourceQuery = sourceQuery.replace(
          /SELECT\s+/i, 
          `SELECT '${source.name}' as source, `
        );
        logToFile('DEBUG', `Generated source query ${index + 1}`, { 
          source: source.name, 
          sourceQuery: finalSourceQuery 
        });
        return finalSourceQuery;
      }
      
      logToFile('DEBUG', `Generated source query ${index + 1} (no SELECT found)`, { 
        source: source.name, 
        sourceQuery 
      });
      return sourceQuery;
    });

    const finalUnionQuery = unionQueries.join(' UNION ALL ');
    logToFile('INFO', 'Generated multi-source UNION query', { 
      sourceCount: unionQueries.length,
      finalQuery: finalUnionQuery
    });
    console.error(`Generated multi-source query with ${unionQueries.length} sources`);
    return finalUnionQuery;
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
        query: finalQuery,
        queryLength: finalQuery.length,
        endpoint: this.config.clickhouseQueryEndpoint,
        username: this.config.clickhouseUsername,
        tableReferences: finalQuery.match(/remote\([^)]+\)/g) || [],
        s3ClusterReferences: finalQuery.match(/s3Cluster\([^)]+\)/g) || []
      });
      
      const response = await BetterstackClient.rateLimiter(() => 
        this.queryClient.post('/', finalQuery)
      );

      logToFile('INFO', 'ClickHouse API response received', {
        status: response.status,
        statusText: response.statusText,
        dataLength: response.data?.data?.length || response.data?.length || 0,
        responseDataKeys: Object.keys(response.data || {}),
        responseHeaders: response.headers,
        firstFewChars: JSON.stringify(response.data).substring(0, 200)
      });

      return {
        data: response.data.data || response.data || [],
        meta: {
          total_rows: response.data.rows || response.data.length,
          sources_queried: sources.map(s => s.name),
          api_used: 'clickhouse',
          executed_sql: finalQuery.replace(' FORMAT JSON', '')
        }
      };
    } catch (error: any) {
      const responseData = error?.response?.data;
      const response = error?.response;
      
      // First, log the complete raw error structure to understand what we're working with
      logToFile('DEBUG', 'Complete raw error structure analysis', {
        hasError: !!error,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorName: error?.name,
        errorMessage: error?.message,
        errorCode: error?.code,
        isAxiosError: error?.isAxiosError,
        // Check all possible locations for response data
        hasResponse: !!error?.response,
        responseType: typeof error?.response,
        hasResponseData: !!error?.response?.data,
        responseDataType: typeof error?.response?.data,
        responseDataConstructor: error?.response?.data?.constructor?.name,
        responseDataKeys: error?.response?.data && typeof error?.response?.data === 'object' 
          ? Object.keys(error.response.data) 
          : 'not an object',
        responseDataStringified: error?.response?.data 
          ? JSON.stringify(error.response.data, null, 2).substring(0, 1000)
          : 'no response data',
        // Also check if error itself contains the response data
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : 'not an object',
        // Check for data property directly on error
        hasErrorData: !!error?.data,
        errorDataType: typeof error?.data,
        errorDataStringified: error?.data 
          ? JSON.stringify(error.data, null, 2).substring(0, 1000)
          : 'no error data',
        // Completely serialize the error to see everything
        completeErrorSerialized: JSON.stringify(error, Object.getOwnPropertyNames(error), 2).substring(0, 2000)
      });
      
      let detailedError = {
        error: error?.message || error?.toString(),
        status: response?.status,
        statusText: response?.statusText,
        responseHeaders: response?.headers,
        fullResponse: responseData,
        clickhouseException: null as any,
        responseDataType: typeof responseData,
        responseDataLength: responseData ? (typeof responseData === 'string' ? responseData.length : JSON.stringify(responseData).length) : 0,
        hasResponseData: !!responseData,
        rawResponseData: responseData,
        stack: error?.stack,
        tableReferencesInQuery: finalQuery.match(/remote\([^)]+\)/g) || [],
        possibleTableIssue: finalQuery.includes('remote(') && response?.status === 404,
        queryThatFailed: finalQuery,
        completedFullErrorLogging: false
      };

      // Comprehensive ClickHouse exception extraction - check all possible locations
      try {
        let extractedData = null;
        let dataSource = '';
        
        // Priority 1: error.response.data (standard Axios error location)
        if (error?.response?.data) {
          extractedData = error.response.data;
          dataSource = 'error.response.data';
        }
        // Priority 2: error.data (sometimes Axios puts data here)
        else if (error?.data) {
          extractedData = error.data;
          dataSource = 'error.data';
        }
        // Priority 3: Look for any property that looks like response data
        else if (error && typeof error === 'object') {
          // Check for properties that might contain the ClickHouse response
          const possibleDataProps = ['responseData', 'body', 'content', 'result'];
          for (const prop of possibleDataProps) {
            if (error[prop]) {
              extractedData = error[prop];
              dataSource = `error.${prop}`;
              break;
            }
          }
          
          // If still no data, check if error has exception property directly
          if (!extractedData && error.exception) {
            extractedData = { exception: error.exception };
            dataSource = 'error.exception';
          }
        }
        
        if (extractedData) {
          // Case 1: Standard object response
          if (typeof extractedData === 'object' && extractedData !== null) {
            detailedError.clickhouseException = {
              type: 'object_response',
              dataSource: dataSource,
              fullObject: extractedData,
              // Look for common ClickHouse error fields
              exception: extractedData.exception || null,
              code: extractedData.code || null,
              message: extractedData.message || null,
              meta: extractedData.meta || null,
              data: extractedData.data || null,
              rows: extractedData.rows || null,
              error: extractedData.error || null,
              // Check for nested exception data
              exceptionDetails: extractedData.exception ? {
                name: extractedData.exception.name || null,
                message: extractedData.exception.message || null,
                stack: extractedData.exception.stack || null
              } : null,
              allKeys: Object.keys(extractedData)
            };
          }
          // Case 2: String response (common for ClickHouse text errors)
          else if (typeof extractedData === 'string') {
            detailedError.clickhouseException = {
              type: 'string_response',
              dataSource: dataSource,
              rawError: extractedData,
              stringLength: extractedData.length,
              // Try to parse if it looks like JSON
              possibleJsonParse: (() => {
                try {
                  return JSON.parse(extractedData);
                } catch {
                  return null;
                }
              })()
            };
          }
          // Case 3: Other data types
          else {
            detailedError.clickhouseException = {
              type: 'other_response',
              dataSource: dataSource,
              dataType: typeof extractedData,
              data: extractedData,
              stringified: String(extractedData)
            };
          }
        } else {
          // No response data found anywhere
          detailedError.clickhouseException = {
            type: 'no_response_data_found',
            reason: 'No response data found in any expected location',
            searchedLocations: [
              'error.response.data',
              'error.data',
              'error.responseData',
              'error.body',
              'error.content',
              'error.result',
              'error.exception'
            ]
          };
        }
        
        detailedError.completedFullErrorLogging = true;
      } catch (parseError) {
        detailedError.clickhouseException = {
          type: 'parsing_failed',
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          originalData: responseData
        };
      }

      // Additional comprehensive error logging
      logToFile('DEBUG', 'Comprehensive error analysis', {
        axiosErrorDetails: {
          isAxiosError: error?.isAxiosError,
          errorName: error?.name,
          errorMessage: error?.message,
          errorCode: error?.code,
          errorStack: error?.stack?.substring(0, 500) + '...'
        },
        responseDetails: {
          hasResponse: !!error?.response,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          headers: error?.response?.headers,
          data: error?.response?.data,
          dataType: typeof error?.response?.data,
          dataString: error?.response?.data ? String(error?.response?.data).substring(0, 1000) : 'no data'
        },
        requestDetails: {
          method: error?.config?.method,
          url: error?.config?.url,
          baseURL: error?.config?.baseURL,
          timeout: error?.config?.timeout,
          dataLength: error?.config?.data?.length || 0
        }
      });

      logToFile('ERROR', 'ClickHouse query execution failed - complete details', detailedError);

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