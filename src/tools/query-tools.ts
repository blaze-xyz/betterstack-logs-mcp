import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BetterstackClient } from '../betterstack-client.js';
import { QueryOptions, DataSourceType } from '../types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Types for structured query building
interface StructuredQueryParams {
  fields: string[];
  filters?: {
    raw_like?: string;
    raw_contains?: string;
    raw_regex?: string;
    level?: string;
    time_range?: {
      start?: string;
      end?: string;
      last?: string;
    };
    json_field?: {
      path: string;
      value: string;
    };
  };
  orderBy: string;
  orderDirection: string;
  limit: number;
}

// Setup logging - use the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = path.join(path.dirname(path.dirname(__dirname)), 'mcp-debug.log');
const logToFile = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] QUERY-TOOLS ${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  fs.appendFileSync(logFile, logEntry);
  console.error(`QUERY-TOOLS ${level}: ${message}`, data || '');
};

/**
 * Builds a ClickHouse SQL query from structured parameters
 */
async function buildStructuredQuery(params: StructuredQueryParams): Promise<string> {
  const { fields, filters, orderBy, orderDirection, limit } = params;
  
  // 1. Validate parameters
  validateQueryParams(params);
  
  // 2. Build SELECT clause
  const selectClause = `SELECT ${fields.join(', ')}`;
  
  // 3. Build FROM clause (will be replaced by buildMultiSourceQuery later)
  const fromClause = 'FROM logs';
  
  // 4. Build WHERE clauses
  const whereConditions: string[] = [];
  
  if (filters) {
    try {
      // Raw log filtering (most common use case)
      if (filters.raw_like) {
        whereConditions.push(`raw LIKE '${sanitizeSqlString(filters.raw_like)}'`);
      }
      
      if (filters.raw_contains) {
        const escaped = sanitizeSqlString(filters.raw_contains);
        whereConditions.push(`raw LIKE '%${escaped}%'`);
      }
      
      if (filters.raw_regex) {
        // Validate regex pattern
        try {
          new RegExp(filters.raw_regex);
        } catch (e) {
          throw new Error(`Invalid regex pattern: ${filters.raw_regex}`);
        }
        const escaped = sanitizeSqlString(filters.raw_regex);
        whereConditions.push(`match(raw, '${escaped}')`);
      }
      
      // Log level filtering
      if (filters.level) {
        const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        if (!validLevels.includes(filters.level)) {
          throw new Error(`Invalid log level: ${filters.level}. Must be one of: ${validLevels.join(', ')}`);
        }
        whereConditions.push(`level = '${filters.level}'`);
      }
      
      // Time range filtering
      if (filters.time_range) {
        const timeFilter = buildTimeRangeFilter(filters.time_range);
        if (timeFilter) {
          whereConditions.push(timeFilter);
        } else {
          throw new Error(`Invalid time range format: ${JSON.stringify(filters.time_range)}`);
        }
      }
      
      // JSON field filtering
      if (filters.json_field) {
        validateJsonFieldFilter(filters.json_field);
        const jsonPath = sanitizeSqlString(filters.json_field.path);
        const jsonValue = sanitizeSqlString(filters.json_field.value);
        whereConditions.push(`JSONExtractString(json, '${jsonPath}') = '${jsonValue}'`);
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
  
  // 6. Add ORDER BY
  query += ` ORDER BY ${orderBy} ${orderDirection}`;
  
  // 7. Add LIMIT
  query += ` LIMIT ${limit}`;
  
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
function validateQueryParams(params: StructuredQueryParams): void {
  const { fields, orderBy, orderDirection, limit } = params;
  
  // Validate fields
  const validFields = ['dt', 'raw', 'level', 'json', 'source'];
  const invalidFields = fields.filter(field => !validFields.includes(field));
  if (invalidFields.length > 0) {
    throw new Error(`Invalid fields: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`);
  }
  
  // Validate orderBy
  const validOrderFields = ['dt', 'level'];
  if (!validOrderFields.includes(orderBy)) {
    throw new Error(`Invalid order_by field: ${orderBy}. Valid fields are: ${validOrderFields.join(', ')}`);
  }
  
  // Validate orderDirection
  const validDirections = ['ASC', 'DESC'];
  if (!validDirections.includes(orderDirection)) {
    throw new Error(`Invalid order_direction: ${orderDirection}. Valid directions are: ${validDirections.join(', ')}`);
  }
  
  // Validate limit
  if (limit < 1 || limit > 1000) {
    throw new Error(`Invalid limit: ${limit}. Must be between 1 and 1000`);
  }
}

/**
 * Sanitizes SQL strings to prevent injection attacks
 */
function sanitizeSqlString(input: string): string {
  return input.replace(/'/g, "''");
}

/**
 * Validates JSON field filter parameters
 */
function validateJsonFieldFilter(jsonField: { path: string; value: string }): void {
  if (!jsonField.path || typeof jsonField.path !== 'string') {
    throw new Error('JSON field path is required and must be a string');
  }
  
  if (!jsonField.value || typeof jsonField.value !== 'string') {
    throw new Error('JSON field value is required and must be a string');
  }
  
  // Validate JSON path format (basic validation)
  if (!jsonField.path.match(/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/)) {
    throw new Error(`Invalid JSON path format: ${jsonField.path}. Use dot notation like 'user.id' or 'request.method'`);
  }
}

/**
 * Converts time range parameters to ClickHouse WHERE conditions
 */
function buildTimeRangeFilter(timeRange: { start?: string; end?: string; last?: string }): string | null {
  const conditions: string[] = [];
  
  // Handle relative time range (e.g., "last 1h")
  if (timeRange.last) {
    const parsedRelative = parseRelativeTime(timeRange.last);
    if (parsedRelative) {
      return parsedRelative;
    }
    
    // If we couldn't parse the relative time, throw an error
    throw new Error(`Invalid relative time format: '${timeRange.last}'. Use formats like '1h', '30m', '2d', '1 hour', '30 minutes', '2 days'`);
  }
  
  // Handle absolute start/end times
  if (timeRange.start) {
    const startCondition = parseTimeValue(timeRange.start, 'start');
    if (startCondition) {
      conditions.push(startCondition);
    } else {
      throw new Error(`Invalid start time format: '${timeRange.start}'. Use ISO date format (YYYY-MM-DD) or relative time like '1 hour ago'`);
    }
  }
  
  if (timeRange.end) {
    const endCondition = parseTimeValue(timeRange.end, 'end');
    if (endCondition) {
      conditions.push(endCondition);
    } else {
      throw new Error(`Invalid end time format: '${timeRange.end}'. Use ISO date format (YYYY-MM-DD)`);
    }
  }
  
  return conditions.length > 0 ? conditions.join(' AND ') : null;
}

/**
 * Parses relative time expressions like '1h', '30m', '2d', '1 hour', etc.
 */
function parseRelativeTime(timeStr: string): string | null {
  timeStr = timeStr.toLowerCase().trim();
  
  // Parse compact format: '1h', '30m', '2d'  
  const compactMatch = timeStr.match(/^(\d+)([hdm])$/);
  if (compactMatch) {
    const amount = parseInt(compactMatch[1]);
    const unit = compactMatch[2];
    
    let interval: string;
    switch (unit) {
      case 'h': interval = 'HOUR'; break;
      case 'd': interval = 'DAY'; break;
      case 'm': interval = 'MINUTE'; break;
      default: return null;
    }
    
    return `dt >= now() - INTERVAL ${amount} ${interval}`;
  }
  
  // Parse natural language: '1 hour', '30 minutes', '2 days'
  const naturalMatch = timeStr.match(/^(\d+)\s+(hour|minute|day)s?$/);
  if (naturalMatch) {
    const amount = parseInt(naturalMatch[1]);
    const unit = naturalMatch[2];
    
    let interval: string;
    switch (unit) {
      case 'hour': interval = 'HOUR'; break;
      case 'day': interval = 'DAY'; break;
      case 'minute': interval = 'MINUTE'; break;
      default: return null;
    }
    
    return `dt >= now() - INTERVAL ${amount} ${interval}`;
  }
  
  // Parse 'ago' format: '1 hour ago', '30 minutes ago'
  const agoMatch = timeStr.match(/^(\d+)\s+(hour|minute|day)s?\s+ago$/);
  if (agoMatch) {
    const amount = parseInt(agoMatch[1]);
    const unit = agoMatch[2];
    
    let interval: string;
    switch (unit) {
      case 'hour': interval = 'HOUR'; break;
      case 'day': interval = 'DAY'; break;
      case 'minute': interval = 'MINUTE'; break;
      default: return null;
    }
    
    return `dt >= now() - INTERVAL ${amount} ${interval}`;
  }
  
  return null;
}

/**
 * Parses individual time values for start/end times
 */
function parseTimeValue(timeStr: string, type: 'start' | 'end'): string | null {
  timeStr = timeStr.trim();
  
  // ISO date format: 2024-01-15 or 2024-01-15T10:30:00
  if (timeStr.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/)) {
    const operator = type === 'start' ? '>=' : '<=';
    return `dt ${operator} '${timeStr}'`;
  }
  
  // Relative time for start only: '1 hour ago'
  if (type === 'start' && timeStr.includes('ago')) {
    const parsed = parseRelativeTime(timeStr);
    return parsed;
  }
  
  return null;
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
        
        const debugInfo = resolvedSources.map((source: any) => {
          return `**Source: ${source.name}**
- ID: ${source.id}
- Table Name: ${source.table_name || 'NOT SET'}
- Team ID: ${source.team_id || 'NOT SET'}
- Platform: ${source.platform}`;
        });

        // Test query generation
        const testQuery = "SELECT dt, raw FROM logs LIMIT 1";
        const builtQuery = await (client as any).buildMultiSourceQuery(testQuery, resolvedSources, 'recent');

        return {
          content: [
            {
              type: "text",
              text: `**Debug Information**

**Resolved Sources (${resolvedSources.length}):**
${debugInfo.join('\n\n')}

**Test Query Generation:**
Original: ${testQuery}
Generated: ${builtQuery}`
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
      // FIELDS - What to select
      fields: z.array(z.enum([
        'dt',     // Timestamp  
        'raw',    // Log message
        'level',  // Log level (INFO, ERROR, etc.)
        'json',   // Structured log data
        'source'  // Source name
      ])).default(['dt', 'raw']).describe("Fields to select from logs"),

      // FILTERING - What to filter by
      filters: z.object({
        // RAW LOG FILTERING (most common use case)
        raw_like: z.string().optional().describe("SQL LIKE pattern matching on raw field (e.g., '%error%')"),
        raw_contains: z.string().optional().describe("Simple substring search in raw field"),
        raw_regex: z.string().optional().describe("Regex pattern matching on raw field"),
        
        // LOG LEVEL FILTERING
        level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).optional().describe("Filter by log level"),
        
        // TIME RANGE FILTERING
        time_range: z.object({
          start: z.string().optional().describe("Start time (ISO date or relative like '1 hour ago')"),
          end: z.string().optional().describe("End time (ISO date or relative)"),
          last: z.string().optional().describe("Relative time range (e.g., '1h', '30m', '2d')")
        }).optional().describe("Time range for filtering logs"),
        
        // STRUCTURED DATA FILTERING
        json_field: z.object({
          path: z.string().describe("JSON field path (e.g., 'user.id', 'request.method')"),
          value: z.string().describe("Expected value for the JSON field")
        }).optional().describe("Filter by JSON field values")
      }).optional().describe("Filters to apply to log query"),

      // SORTING - How to order results
      order_by: z.enum(['dt', 'level']).default('dt').describe("Field to sort by"),
      order_direction: z.enum(['ASC', 'DESC']).default('DESC').describe("Sort direction"),

      // LIMITS - Result size control
      limit: z.number().min(1).max(1000).default(10).describe("Maximum number of results to return"),

      // SOURCES - Same as current tool
      sources: z.array(z.string()).optional().describe("Specific source IDs or names to query (optional)"),
      source_group: z.string().optional().describe("Source group name to query (optional)"),
      data_type: z.enum(['recent', 'historical', 'metrics']).optional().describe("Type of data to query (default: recent)")
    },
    async ({ fields, filters, order_by, order_direction, limit, sources, source_group, data_type }) => {
      try {
        logToFile('INFO', 'Executing structured query_logs tool', { 
          fields, filters, order_by, order_direction, limit, sources, source_group, data_type 
        });
        
        // Build the SQL query from structured parameters
        const query = await buildStructuredQuery({
          fields,
          filters,
          orderBy: order_by,
          orderDirection: order_direction,
          limit
        });

        logToFile('INFO', 'Generated SQL query', { query });
        
        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: data_type as DataSourceType,
          limit
        };

        logToFile('INFO', 'Query options prepared', options);
        const result = await client.executeQuery(query, options);
        logToFile('INFO', 'Query executed successfully', { resultCount: result.data?.length, meta: result.meta });
        
        const resultText = [
          `**Query Results**`,
          `Sources queried: ${result.meta?.sources_queried?.join(', ') || 'unknown'}`,
          `Total rows: ${result.meta?.total_rows || result.data.length}`,
          `Executed SQL: \`${result.meta?.executed_sql || query}\``,
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
              Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(', ') :
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

  // Simple text search across logs
  server.tool(
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
  );

  // Get recent logs with optional filters
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

  // Get historical logs with date ranges
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

  // Query performance metrics
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
  );
}