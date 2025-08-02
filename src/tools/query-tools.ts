import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BetterstackClient } from '../betterstack-client.js';
import { QueryOptions, DataSourceType, TimeFilter } from '../types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ClickHouse output format types
export type ClickHouseFormat = 'JSON' | 'JSONEachRow' | 'Pretty' | 'CSV' | 'TSV';

// Types for structured query building
export interface StructuredQueryParams {
  filters?: {
    raw_contains?: string[];
    level?: string;
    time_filter?: TimeFilter;
  };
  limit: number;
  dataType?: 'recent' | 'historical' | 'metrics' | 'union';
}

// Setup logging using shared utility
import { createLogger } from '../utils/logging.js';

const logToFile = createLogger(import.meta.url, 'QUERY-TOOLS');

/**
 * Extracts the message field from a raw log JSON string
 * Fallback hierarchy: message -> msg -> raw string itself
 */
export function extractMessage(rawLog: string): string {
  try {
    const parsed = JSON.parse(rawLog);
    // Try common message field names
    return parsed.message || parsed.msg || rawLog;
  } catch {
    // If JSON parsing fails, return the raw string
    return rawLog;
  }
}

/**
 * Builds a ClickHouse SQL query from structured parameters
 * Always queries 'dt' (timestamp) and 'raw' (log message) fields
 */
export async function buildStructuredQuery(params: StructuredQueryParams): Promise<string> {
  const { filters, limit, dataType } = params;
  
  // 1. Validate parameters
  validateQueryParams(params);
  
  // 2. Build SELECT clause - always query dt (timestamp) and raw (log message) fields only
  const selectClause = 'SELECT dt, raw';
  
  // 3. Build FROM clause (will be replaced by buildMultiSourceQuery later)
  // For union queries, we'll use a subquery pattern that will be replaced
  const fromClause = dataType === 'union' ? 'FROM union_subquery' : 'FROM logs';
  
  // 4. Build WHERE clauses
  const whereConditions: string[] = [];
  
  // Note: _row_type = 1 filter is handled at the table level (in s3Cluster queries)
  // and should not be added to the outer WHERE clause for multi-source queries
  
  if (filters) {
    try {
      // Raw log filtering (most common use case) - case-insensitive
      if (filters.raw_contains && filters.raw_contains.length > 0) {
        const conditions = filters.raw_contains.map(keyword => {
          const escaped = sanitizeSqlString(keyword);
          return `ilike(raw, '%${escaped}%')`;
        });
        whereConditions.push(`(${conditions.join(' AND ')})`);
      }
      
      // Log level filtering (using pattern matching)
      if (filters.level) {
        const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        if (!validLevels.includes(filters.level)) {
          throw new Error(`Invalid log level: ${filters.level}. Must be one of: ${validLevels.join(', ')}`);
        }
        whereConditions.push(buildLevelFilter(filters.level));
      }
      
      // Time filtering
      if (filters.time_filter) {
        const timeFilter = buildTimeFilter(filters.time_filter);
        if (timeFilter !== null) {
          // Only add the condition if it's not empty (empty string means "everything")
          if (timeFilter !== '') {
            whereConditions.push(timeFilter);
          }
        } else {
          throw new Error(`Invalid time filter format: ${JSON.stringify(filters.time_filter)}`);
        }
      }
      
    } catch (error) {
      throw new Error(`Filter validation failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  // 5. Build complete query
  let query = selectClause + ' ' + fromClause;
  
  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }
  
  // 6. Add ORDER BY (always most recent first)
  query += ` ORDER BY dt DESC`;
  
  // 7. Add LIMIT
  query += ` LIMIT ${limit}`;
  
  // 8. Add FORMAT clause - always use JSONEachRow with array output
  query += ` SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
  
  logToFile('DEBUG', 'Generated structured query', { 
    params, 
    generatedQuery: query,
    whereConditions 
  });
  
  return query;
}

/**
 * Validates query parameters for security and correctness
 */
export function validateQueryParams(params: StructuredQueryParams): void {
  const { limit } = params;
  
  // Validate limit
  if (limit < 1 || limit > 1000) {
    throw new Error(`Invalid limit: ${limit}. Must be between 1 and 1000`);
  }
}

/**
 * Sanitizes SQL strings to prevent injection attacks
 */
export function sanitizeSqlString(input: string): string {
  return input.replace(/'/g, "''");
}

/**
 * Builds a level filter using simple pattern matching
 * Uses the proven pattern that works in production: "level":"value" 
 */
export function buildLevelFilter(level: string): string {
  // Sanitize the level to prevent SQL injection
  const sanitizedLevel = sanitizeSqlString(level);
  
  // Use the simple JSON pattern that works - lowercase level value as seen in actual logs
  return `ilike(raw, '%"level":"${sanitizedLevel.toLowerCase()}"%')`;
}


/**
 * Converts time filter to ClickHouse WHERE conditions
 */
export function buildTimeFilter(timeFilter: TimeFilter): string | null {
  // Handle relative time filters (enum-based)
  if (timeFilter.relative) {
    return buildRelativeTimeFilter(timeFilter.relative);
  }
  
  // Handle custom time range
  if (timeFilter.custom) {
    const conditions: string[] = [];
    
    try {
      // Handle start_datetime if provided
      if (timeFilter.custom.start_datetime) {
        const startDate = new Date(timeFilter.custom.start_datetime);
        if (isNaN(startDate.getTime())) {
          throw new Error(`Invalid start_datetime: ${timeFilter.custom.start_datetime}`);
        }
        
        // Check if timezone info is present (Z or +/-offset)
        if (timeFilter.custom.start_datetime.includes('Z') || 
            timeFilter.custom.start_datetime.match(/[+-]\d{2}:\d{2}$/)) {
          conditions.push(`dt >= parseDateTime64BestEffort('${timeFilter.custom.start_datetime}')`);
        } else {
          conditions.push(`dt >= '${timeFilter.custom.start_datetime}'`);
        }
      }
      
      // Handle end_datetime if provided
      if (timeFilter.custom.end_datetime) {
        const endDate = new Date(timeFilter.custom.end_datetime);
        if (isNaN(endDate.getTime())) {
          throw new Error(`Invalid end_datetime: ${timeFilter.custom.end_datetime}`);
        }
        
        // Check if timezone info is present (Z or +/-offset)
        if (timeFilter.custom.end_datetime.includes('Z') || 
            timeFilter.custom.end_datetime.match(/[+-]\d{2}:\d{2}$/)) {
          conditions.push(`dt <= parseDateTime64BestEffort('${timeFilter.custom.end_datetime}')`);
        } else {
          conditions.push(`dt <= '${timeFilter.custom.end_datetime}'`);
        }
      }
      
      if (conditions.length === 0) {
        throw new Error('Custom time filter must specify at least start_datetime or end_datetime');
      }
      
      return conditions.join(' AND ');
    } catch (error) {
      throw new Error(`Invalid custom time range: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  return null;
}

/**
 * Builds time filter conditions for relative time options
 */
export function buildRelativeTimeFilter(relative: string): string {
  switch (relative) {
    case 'last_30_minutes':
      return 'dt >= now() - INTERVAL 30 MINUTE';
    case 'last_60_minutes':
      return 'dt >= now() - INTERVAL 60 MINUTE';
    case 'last_3_hours':
      return 'dt >= now() - INTERVAL 3 HOUR';
    case 'last_6_hours':
      return 'dt >= now() - INTERVAL 6 HOUR';
    case 'last_12_hours':
      return 'dt >= now() - INTERVAL 12 HOUR';
    case 'last_24_hours':
      return 'dt >= now() - INTERVAL 24 HOUR';
    case 'last_2_days':
      return 'dt >= now() - INTERVAL 2 DAY';
    case 'last_7_days':
      return 'dt >= now() - INTERVAL 7 DAY';
    case 'last_14_days':
      return 'dt >= now() - INTERVAL 14 DAY';
    case 'last_30_days':
      return 'dt >= now() - INTERVAL 30 DAY';
    case 'everything':
      return ''; // No time filter
    default:
      throw new Error(`Unsupported relative time filter: ${relative}`);
  }
}

/**
 * Determines data source type based on time filters
 * Logic:
 * - No time filter → 'union' (query both recent and historical)
 * - Time filter includes last 24 hours → 'union' (use UNION ALL)
 * - Time filter excludes last 24 hours → 'historical' (s3Cluster only)
 */
export function determineDataType(filters?: StructuredQueryParams['filters']): DataSourceType {
  if (!filters?.time_filter) {
    return 'union'; // Default to union for comprehensive coverage
  }

  const timeFilter = filters.time_filter;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Handle relative time filters
  if (timeFilter.relative) {
    switch (timeFilter.relative) {
      case 'last_30_minutes':
      case 'last_60_minutes':
      case 'last_3_hours':
      case 'last_6_hours':
      case 'last_12_hours':
      case 'last_24_hours':
        return 'union'; // These include recent data, use UNION ALL
      case 'last_2_days':
      case 'last_7_days':
      case 'last_14_days':
      case 'last_30_days':
      case 'everything':
        return 'union'; // These include recent data, use UNION ALL
      default:
        return 'union';
    }
  }

  // Handle custom time ranges
  if (timeFilter.custom) {
    try {
      // Handle cases where start_datetime or end_datetime might be missing
      const { start_datetime, end_datetime } = timeFilter.custom;
      
      // If both are missing, treat as no time filter (union)
      if (!start_datetime && !end_datetime) {
        return 'union';
      }
      
      // If only start_datetime is provided, assume end time is "now" (union)
      if (start_datetime && !end_datetime) {
        return 'union';
      }
      
      // If only end_datetime is provided, check if it's within last 24h
      if (!start_datetime && end_datetime) {
        const endDate = new Date(end_datetime);
        if (isNaN(endDate.getTime())) {
          return 'union'; // Invalid date, default to union
        }
        return endDate >= twentyFourHoursAgo ? 'union' : 'historical';
      }
      
      // Both dates provided - normal logic
      const startDate = new Date(start_datetime!);
      const endDate = new Date(end_datetime!);
      
      // Check for invalid dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return 'union'; // Invalid dates, default to union for safety
      }
      
      // If the time range includes the last 24 hours, use union
      if (endDate >= twentyFourHoursAgo) {
        return 'union';
      } else {
        // If the entire range is before the last 24 hours, use historical only
        return 'historical';
      }
    } catch (e) {
      // If parsing fails, default to union for safety
      return 'union';
    }
  }

  return 'union';
}


export function registerQueryTools(server: McpServer, client: BetterstackClient) {
  
  // Debug tool to show table information and query generation
  server.tool(
    "debug_table_info",
    {
      source_group: z.string().optional().describe("Source group name to debug (optional)"),
      sources: z.array(z.string()).optional().describe("Specific source IDs (optional)")
    },
    async ({ source_group, sources }) => {
      try {
        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: 'recent'
        };

        // Get the sources that would be used
        const resolvedSources = await (client as any).resolveSources(options);
        
        // Get schema information for each source
        const sourcesWithSchema = await client.getSourcesWithSchema(resolvedSources, 'recent');
        
        const debugInfo = [];
        
        for (const { source, schema, tableName } of sourcesWithSchema) {
          const sourceInfo = [`**Source: ${source.name}**`];
          sourceInfo.push(`- ID: ${source.id}`);
          sourceInfo.push(`- Table Name: ${source.table_name || 'NOT SET'}`);
          sourceInfo.push(`- Team ID: ${source.team_id || 'NOT SET'}`);
          sourceInfo.push(`- Platform: ${source.platform}`);
          sourceInfo.push(`- ClickHouse Table: ${tableName}`);
          
          if (schema) {
            sourceInfo.push(`- **Available Columns (${schema.columns.length}):**`);
            const columnList = schema.columns.map(col => `  • **${col.name}** (${col.type})`);
            sourceInfo.push(...columnList);
          } else {
            sourceInfo.push('- **Schema:** ❌ Could not retrieve table schema');
          }
          
          debugInfo.push(sourceInfo.join('\n'));
        }

        // Test query generation
        const testQuery = "SELECT dt, raw FROM logs LIMIT 1";
        const builtQuery = await (client as any).buildMultiSourceQuery(testQuery, resolvedSources, 'recent');

        // Show common fields across all sources
        const allSchemas = sourcesWithSchema.filter(s => s.schema).map(s => s.schema!);
        const commonFields = allSchemas.length > 0 ? 
          allSchemas[0].availableFields.filter(field => 
            allSchemas.every(schema => schema.availableFields.includes(field))
          ) : [];

        const resultText = [
          '**Debug Information**',
          '',
          `**Resolved Sources (${resolvedSources.length}):**`,
          ...debugInfo,
          ''
        ];

        if (commonFields.length > 0) {
          resultText.push('**Common Fields Across All Sources:**');
          resultText.push(commonFields.join(', '));
          resultText.push('');
        } else {
          resultText.push('**Warning:** No common fields found across all sources.');
          resultText.push('');
        }

        resultText.push('**Test Query Generation:**');
        resultText.push(`Original: ${testQuery}`);
        resultText.push(`Generated: ${builtQuery}`);

        return {
          content: [
            {
              type: "text",
              text: resultText.join('\n')
            }
          ]
        };
      } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        return {
          content: [
            {
              type: "text",
              text: `❌ Debug failed: ${errorMessage}`
            }
          ]
        };
      }
    }
  );
  
  // Structured log querying with intelligent parameter handling
  server.tool(
    "query_logs",
    {
      // FILTERING - What to filter by
      filters: z.object({
        // RAW LOG FILTERING (most common use case)
        raw_contains: z.array(z.string()).optional().describe("Array of keywords for case-insensitive substring search in raw field. All keywords must be present in the log message."),
        
        // LOG LEVEL FILTERING (using pattern matching)
        level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).optional().describe("Filter by log level (uses pattern matching)"),
        
        // TIME FILTERING
        time_filter: z.object({
          relative: z.enum([
            'last_30_minutes',
            'last_60_minutes', 
            'last_3_hours',
            'last_6_hours',
            'last_12_hours',
            'last_24_hours',
            'last_2_days',
            'last_7_days',
            'last_14_days',
            'last_30_days',
            'everything'
          ]).optional().describe("Relative time filter matching BetterStack UI options"),
          custom: z.object({
            start_datetime: z.string().describe("ISO datetime string for start time"),
            end_datetime: z.string().describe("ISO datetime string for end time")
          }).optional().describe("Custom time range with precise datetime strings")
        }).refine((data) => {
          // Ensure only one of relative or custom is provided, not both
          const hasRelative = data.relative !== undefined;
          const hasCustom = data.custom !== undefined;
          return !(hasRelative && hasCustom);
        }, {
          message: "Cannot specify both 'relative' and 'custom' time filters. Use either relative (e.g., 'last_30_minutes') or custom (with start_datetime/end_datetime), not both."
        }).optional().describe("Time filter for logs - use either relative or custom, not both"),
        
      }).optional().describe("Filters to apply to log query"),

      // LIMITS - Result size control (always ordered by most recent first)
      limit: z.number().min(1).max(1000).default(10).describe("Maximum number of results to return"),

      // SOURCES - What to query from
      sources: z.array(z.string()).optional().describe("Specific source IDs or names to query (optional)"),
      source_group: z.string().optional().describe("Source group name to query (optional)"),
      
      // RESPONSE FORMAT - How to display results
      response_format: z.enum(['compact', 'full']).default('compact').describe("Response format: 'compact' shows timestamp and message only (default), 'full' shows complete raw log data"),
      
    },
    async ({ filters, limit, sources, source_group, response_format }) => {
      try {
        // Ensure response_format defaults to 'compact' if not provided
        const actualResponseFormat = response_format || 'compact';
        
        logToFile('INFO', 'Executing structured query_logs tool', { 
          filters, limit, sources, source_group, response_format: actualResponseFormat
        });
        
        // Step 1: Determine data type automatically based on time filters
        const dataType = determineDataType(filters);
        
        // Step 2: Resolve sources first
        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType,
          limit,
          rawFilters: filters ? { time_filter: filters.time_filter } : undefined
        };
        
        const resolvedSources = await (client as any).resolveSources(options);
        logToFile('INFO', 'Resolved sources', { 
          sourceCount: resolvedSources.length,
          sources: resolvedSources.map((s: any) => ({ id: s.id, name: s.name }))
        });

        // Step 3: Build the SQL query from structured parameters
        // Always query 'dt' (timestamp) and 'raw' (log message) fields
        const query = await buildStructuredQuery({
          filters,
          limit,
          dataType
        });

        logToFile('INFO', 'Generated SQL query', { query });
        logToFile('INFO', 'Query options prepared', options);
        const result = await client.executeQuery(query, options);
        logToFile('INFO', 'Query executed successfully', { resultCount: result.data?.length, meta: result.meta });
        
        // Prepare cache metadata
        const cacheMetadata = {
          sources_queried: result.meta?.sources_queried || [],
          executed_sql: result.meta?.executed_sql || query,
          request_url: result.meta?.request_url || 'unknown',
          api_used: result.meta?.api_used || 'clickhouse',
          total_rows: result.meta?.total_rows || result.data.length
        };
        
        let cacheId: string | null = null;
        
        // For compact format, cache the results for later detail retrieval
        if (actualResponseFormat === 'compact' && result.data.length > 0) {
          cacheId = client.generateCacheId(query, options);
          const logEntries = result.data.map((row: any) => ({
            dt: row.dt || '',
            raw: row.raw || ''
          }));
          client.cacheLogResults(cacheId, logEntries, cacheMetadata);
        }
        
        // Build response based on format
        const formatType = actualResponseFormat === 'compact' ? 'Compact View' : 'Full View';
        const resultText = [
          `**Query Results (${formatType})**`,
          ...(cacheId ? [`Cache ID: ${cacheId}`] : []),
          `Sources queried: ${cacheMetadata.sources_queried.join(', ') || 'unknown'}`,
          `Total rows: ${cacheMetadata.total_rows}`,
          `Executed SQL: \`${cacheMetadata.executed_sql}\``,
          `Request URL: ${cacheMetadata.request_url}`,
          `API used: ${cacheMetadata.api_used}`,
          '',
          actualResponseFormat === 'compact' ? '**Logs:**' : '**Data:**'
        ];

        if (result.data.length === 0) {
          resultText.push('No results found.');
        } else {
          if (actualResponseFormat === 'compact') {
            // Compact format: show timestamp and extracted message
            const formatted = result.data.map((row: any, index: number) => {
              const timestamp = row.dt || 'Unknown time';
              const message = extractMessage(row.raw || '');
              return `${index + 1}. ${timestamp}: ${message}`;
            });
            
            resultText.push(...formatted);
            
            if (cacheId) {
              resultText.push('');
              resultText.push(`Use 'get_log_details' with cache_id='${cacheId}' and log_index=N to see full details.`);
            }
          } else {
            // Full format: show complete data (original behavior)
            const displayRows = result.data.slice(0, 10);
            const formatted = displayRows.map((row, index) => {
              const rowData = typeof row === 'object' ? 
                Object.entries(row).map(([key, value]) => {
                  // Handle object values (like json field) by stringifying them
                  const formattedValue = (typeof value === 'object' && value !== null) 
                    ? JSON.stringify(value)
                    : String(value);
                  return `${key}: ${formattedValue}`;
                }).join(', ') :
                String(row);
              return `${index + 1}. ${rowData}`;
            });
            
            resultText.push(...formatted);
            
            if (result.data.length > 10) {
              resultText.push(`... and ${result.data.length - 10} more rows`);
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: resultText.join('\n')
            }
          ]
        };
      } catch (error: any) {
        logToFile('ERROR', 'Query failed in query_logs tool', { 
          error: error?.message || error?.toString(),
          response: error?.response?.data,
          config: error?.config,
          stack: error?.stack
        });
        
        const errorMessage = error?.message || error?.response?.data?.message || error?.toString() || 'Unknown error';
        const errorDetails = error?.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No additional details';
        return {
          content: [
            {
              type: "text",
              text: `❌ Query failed: ${errorMessage}

**Error Details:**
${errorDetails}`
            }
          ]
        };
      }
    }
  );

  // Get detailed log information from cached compact query results
  server.tool(
    "get_log_details",
    {
      cache_id: z.string().describe("Cache ID from a previous compact query_logs response"),
      log_index: z.number().min(0).describe("Zero-based index of the log entry from the compact results")
    },
    async ({ cache_id, log_index }) => {
      try {
        logToFile('INFO', 'Executing get_log_details tool', { cache_id, log_index });
        
        const result = client.getCachedLogDetails(cache_id, log_index);
        
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `❌ ${result.error}`
              }
            ]
          };
        }
        
        const { log, metadata } = result;
        
        const resultText = [
          `**Log Details (Index ${log_index})**`,
          `Cache ID: ${cache_id}`,
          `Timestamp: ${log.dt}`,
          `Source: ${metadata.sources_queried?.join(', ') || 'Unknown'}`,
          '',
          '**Full Raw Data:**',
          log.raw
        ];

        return {
          content: [
            {
              type: "text",
              text: resultText.join('\n')
            }
          ]
        };
      } catch (error: any) {
        logToFile('ERROR', 'get_log_details failed', { 
          error: error?.message || error?.toString(),
          cache_id,
          log_index,
          stack: error?.stack
        });
        
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to retrieve log details: ${errorMessage}`
            }
          ]
        };
      }
    }
  );

}