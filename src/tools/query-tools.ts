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
    raw_contains?: string;
    level?: string;
    time_filter?: TimeFilter;
  };
  limit: number;
  dataType?: 'recent' | 'historical' | 'metrics' | 'union';
  format?: ClickHouseFormat;
}

// Setup logging using shared utility
import { createLogger } from '../utils/logging.js';

const logToFile = createLogger(import.meta.url, 'QUERY-TOOLS');

/**
 * Builds a ClickHouse SQL query from structured parameters
 * Always queries 'dt' (timestamp) and 'raw' (log message) fields
 */
export async function buildStructuredQuery(params: StructuredQueryParams): Promise<string> {
  const { filters, limit, dataType, format = 'JSONEachRow' } = params;
  
  // 1. Validate parameters
  validateQueryParams(params);
  
  // 2. Build SELECT clause - always query dt (timestamp) and raw (log message) fields only
  const selectClause = 'SELECT dt, raw';
  
  // 3. Build FROM clause (will be replaced by buildMultiSourceQuery later)
  // For union queries, we'll use a subquery pattern that will be replaced
  const fromClause = dataType === 'union' ? 'FROM union_subquery' : 'FROM logs';
  
  // 4. Build WHERE clauses
  const whereConditions: string[] = [];
  
  // Add required filter for historical data
  if (dataType === 'historical') {
    whereConditions.push('_row_type = 1');
  }
  
  if (filters) {
    try {
      // Raw log filtering (most common use case) - case-insensitive
      if (filters.raw_contains) {
        const escaped = sanitizeSqlString(filters.raw_contains);
        whereConditions.push(`ilike(raw, '%${escaped}%')`);
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
  
  // 8. Add FORMAT clause and SETTINGS for JSONEachRow
  if (format === 'JSONEachRow') {
    query += ` SETTINGS output_format_json_array_of_rows = 1 FORMAT ${format}`;
  } else {
    query += ` FORMAT ${format}`;
  }
  
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
        raw_contains: z.string().optional().describe("Case-insensitive substring search in raw field"),
        
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
      
      // OUTPUT FORMAT - How to format the results
      format: z.enum(['JSON', 'JSONEachRow', 'Pretty', 'CSV', 'TSV']).default('JSONEachRow').describe("Output format for query results. JSONEachRow is best for programmatic access, Pretty for human reading, CSV/TSV for data export")
    },
    async ({ filters, limit, sources, source_group, format }) => {
      try {
        logToFile('INFO', 'Executing structured query_logs tool', { 
          filters, limit, sources, source_group, format 
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
          dataType,
          format
        });

        logToFile('INFO', 'Generated SQL query', { query });
        logToFile('INFO', 'Query options prepared', options);
        const result = await client.executeQuery(query, options);
        logToFile('INFO', 'Query executed successfully', { resultCount: result.data?.length, meta: result.meta });
        
        const resultText = [
          `**Query Results**`,
          `Sources queried: ${result.meta?.sources_queried?.join(', ') || 'unknown'}`,
          `Total rows: ${result.meta?.total_rows || result.data.length}`,
          `Executed SQL: \`${result.meta?.executed_sql || query}\``,
          `Request URL: ${result.meta?.request_url || 'unknown'}`,
          '',
          '**Data:**'
        ];

        if (result.data.length === 0) {
          resultText.push('No results found.');
        } else {
          // Format first few rows for display
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

  // Simple text search across logs - COMMENTED OUT FOR FOCUSED TESTING
  /*server.tool(
    "search_logs",
    {
      search_text: z.string().describe("Text to search for in log messages"),
      sources: z.array(z.string()).optional().describe("Specific source IDs or names to search (optional)"),
      source_group: z.string().optional().describe("Source group name to search (optional)"),
      data_type: z.enum(['recent', 'historical']).optional().describe("Type of logs to search (default: recent)"),
      time_range_hours: z.number().optional().describe("Number of hours back to search (default: 24)"),
      limit: z.number().optional().describe("Maximum number of results to return (default: 100)")
    },
    async ({ search_text, sources, source_group, data_type, time_range_hours, limit }) => {
      try {
        logToFile('INFO', 'Executing search_logs tool', { search_text, sources, source_group, data_type, time_range_hours, limit });
        
        const hours = time_range_hours || 24;
        const maxResults = limit || 100;
        
        const query = `
          SELECT dt, raw, json 
          FROM logs 
          WHERE (raw LIKE '%${search_text}%' OR toString(json) LIKE '%${search_text}%')
            AND dt >= now() - INTERVAL ${hours} HOUR 
          ORDER BY dt DESC
        `;

        logToFile('INFO', 'Generated search query', { query: query.trim(), search_text });

        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: data_type as DataSourceType || 'recent',
          limit: maxResults
        };

        logToFile('INFO', 'Search options prepared', options);
        const result = await client.executeQuery(query, options);
        logToFile('INFO', 'Search executed successfully', { resultCount: result.data?.length, meta: result.meta });
        
        const resultText = [
          `**Search Results for "${search_text}"**`,
          `Time range: Last ${hours} hours`,
          `Sources searched: ${result.meta?.sources_queried?.join(', ') || 'default'}`,
          `Matches found: ${result.data.length}`,
          ''
        ];

        if (result.data.length === 0) {
          resultText.push('No matches found.');
        } else {
          const matches = result.data.slice(0, 20).map((log: any, index) => {
            const timestamp = new Date(log.dt).toLocaleString();
            
            // Try to extract better formatted message from JSON if available
            let message = log.raw;
            if (log.json && typeof log.json === 'object') {
              // If we have JSON, try to get context and error details
              const context = log.json.context || '';
              const level = log.json.level || '';
              const jsonMessage = log.json.message || log.json.error || '';
              
              if (jsonMessage && jsonMessage !== log.raw) {
                message = `[${level}] ${context}: ${jsonMessage}`;
              }
            }

            return `**${index + 1}.** ${timestamp}\n${message}`;
          });
          
          resultText.push(...matches);
          
          if (result.data.length > 20) {
            resultText.push(`\n... and ${result.data.length - 20} more matches`);
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
        logToFile('ERROR', 'Search failed in search_logs tool', { 
          error: error?.message || error?.toString(),
          response: error?.response?.data,
          config: error?.config,
          stack: error?.stack
        });
        
        return {
          content: [
            {
              type: "text",
              text: `❌ Search failed: ${error}`
            }
          ]
        };
      }
    }
  );*/

  // Get recent logs with optional filters - COMMENTED OUT FOR FOCUSED TESTING
  /*
  server.tool(
    "get_recent_logs",
    {
      sources: z.array(z.string()).optional().describe("Specific source IDs or names (optional)"),
      source_group: z.string().optional().describe("Source group name (optional)"),
      time_range_minutes: z.number().optional().describe("Number of minutes back to fetch (default: 60)"),
      severity_filter: z.string().optional().describe("Filter by severity level (e.g., 'error', 'warning')"),
      limit: z.number().optional().describe("Maximum number of logs to return (default: 50)")
    },
    async ({ sources, source_group, time_range_minutes, severity_filter, limit }) => {
      try {
        const minutes = time_range_minutes || 60;
        const maxResults = limit || 50;
        
        let whereConditions = [`dt >= now() - INTERVAL ${minutes} MINUTE`];
        
        if (severity_filter) {
          whereConditions.push(`raw LIKE '%${severity_filter}%'`);
        }
        
        const query = `
          SELECT dt, raw 
          FROM logs 
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY dt DESC
        `;

        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: 'recent',
          limit: maxResults
        };

        const result = await client.executeQuery(query, options);
        
        const resultText = [
          `**Recent Logs**`,
          `Time range: Last ${minutes} minutes`,
          `Sources: ${result.meta?.sources_queried?.join(', ') || 'default'}`,
          severity_filter ? `Severity filter: ${severity_filter}` : null,
          `Logs found: ${result.data.length}`,
          ''
        ].filter(Boolean);

        if (result.data.length === 0) {
          resultText.push('No recent logs found.');
        } else {
          const logs = result.data.map((log: any, index) => {
            const timestamp = new Date(log.dt).toLocaleString();
            const message = log.raw;
            const source = log.source ? ` [${log.source}]` : '';
            return `**${index + 1}.** ${timestamp}${source}\n${message}`;
          });
          
          resultText.push(...logs);
        }

        return {
          content: [
            {
              type: "text",
              text: resultText.join('\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to get recent logs: ${error}`
            }
          ]
        };
      }
    }
  );

  // Get historical logs with date ranges - COMMENTED OUT FOR FOCUSED TESTING
  /*
  server.tool(
    "get_historical_logs",
    {
      start_date: z.string().describe("Start date for historical query (YYYY-MM-DD format)"),
      end_date: z.string().describe("End date for historical query (YYYY-MM-DD format)"),
      sources: z.array(z.string()).optional().describe("Specific source IDs or names (optional)"),
      source_group: z.string().optional().describe("Source group name (optional)"),
      search_text: z.string().optional().describe("Text to search for in historical logs"),
      limit: z.number().optional().describe("Maximum number of logs to return (default: 100)")
    },
    async ({ start_date, end_date, sources, source_group, search_text, limit }) => {
      try {
        const maxResults = limit || 100;
        
        let whereConditions = [
          `dt >= '${start_date}'`,
          `dt <= '${end_date}'`
        ];
        
        if (search_text) {
          whereConditions.push(`raw LIKE '%${search_text}%'`);
        }
        
        const query = `
          SELECT dt, raw 
          FROM logs 
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY dt DESC
        `;

        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: 'historical',
          limit: maxResults
        };

        const result = await client.executeQuery(query, options);
        
        const resultText = [
          `**Historical Logs**`,
          `Date range: ${start_date} to ${end_date}`,
          `Sources: ${result.meta?.sources_queried?.join(', ') || 'default'}`,
          search_text ? `Search filter: "${search_text}"` : null,
          `Logs found: ${result.data.length}`,
          ''
        ].filter(Boolean);

        if (result.data.length === 0) {
          resultText.push('No historical logs found for the specified criteria.');
        } else {
          const logs = result.data.slice(0, 15).map((log: any, index) => {
            const timestamp = new Date(log.dt).toLocaleString();
            const message = log.raw;
            const source = log.source ? ` [${log.source}]` : '';
            return `**${index + 1}.** ${timestamp}${source}\n${message}`;
          });
          
          resultText.push(...logs);
          
          if (result.data.length > 15) {
            resultText.push(`\n... and ${result.data.length - 15} more logs`);
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
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to get historical logs: ${error}`
            }
          ]
        };
      }
    }
  );

  // Query performance metrics - COMMENTED OUT FOR FOCUSED TESTING
  /*
  server.tool(
    "query_metrics",
    {
      metric_name: z.string().optional().describe("Specific metric name to query (optional)"),
      sources: z.array(z.string()).optional().describe("Specific source IDs or names (optional)"),
      source_group: z.string().optional().describe("Source group name (optional)"),
      time_range_hours: z.number().optional().describe("Number of hours back to query (default: 24)"),
      limit: z.number().optional().describe("Maximum number of metric points to return (default: 100)")
    },
    async ({ metric_name, sources, source_group, time_range_hours, limit }) => {
      try {
        const hours = time_range_hours || 24;
        const maxResults = limit || 100;
        
        let whereConditions = [`dt >= now() - INTERVAL ${hours} HOUR`];
        
        if (metric_name) {
          whereConditions.push(`metric_name = '${metric_name}'`);
        }
        
        const query = `
          SELECT dt, metric_name, value 
          FROM metrics 
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY dt DESC
        `;

        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: 'metrics',
          limit: maxResults
        };

        const result = await client.executeQuery(query, options);
        
        const resultText = [
          `**Performance Metrics**`,
          `Time range: Last ${hours} hours`,
          `Sources: ${result.meta?.sources_queried?.join(', ') || 'default'}`,
          metric_name ? `Metric filter: ${metric_name}` : 'All metrics',
          `Data points: ${result.data.length}`,
          ''
        ];

        if (result.data.length === 0) {
          resultText.push('No metrics found for the specified criteria.');
        } else {
          const metrics = result.data.slice(0, 20).map((metric: any, index) => {
            const timestamp = new Date(metric.dt).toLocaleString();
            const source = metric.source ? ` [${metric.source}]` : '';
            return `**${index + 1}.** ${timestamp}${source}\n${metric.metric_name}: ${metric.value}`;
          });
          
          resultText.push(...metrics);
          
          if (result.data.length > 20) {
            resultText.push(`\n... and ${result.data.length - 20} more data points`);
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
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to query metrics: ${error}`
            }
          ]
        };
      }
    }
  );*/
}