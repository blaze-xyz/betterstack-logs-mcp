import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BetterstackClient } from '../betterstack-client.js';
import { QueryOptions, DataSourceType } from '../types.js';
import fs from 'fs';
import path from 'path';

// Setup logging
const logFile = path.join(process.cwd(), 'mcp-debug.log');
const logToFile = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] QUERY-TOOLS ${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  fs.appendFileSync(logFile, logEntry);
  console.error(`QUERY-TOOLS ${level}: ${message}`, data || '');
};

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
  
  // Execute custom ClickHouse SQL queries
  server.tool(
    "query_logs",
    {
      query: z.string().describe("ClickHouse SQL query to execute"),
      sources: z.array(z.string()).optional().describe("Specific source IDs or names to query (optional)"),
      source_group: z.string().optional().describe("Source group name to query (optional)"),
      data_type: z.enum(['recent', 'historical', 'metrics']).optional().describe("Type of data to query (default: recent)"),
      limit: z.number().optional().describe("Maximum number of results to return")
    },
    async ({ query, sources, source_group, data_type, limit }) => {
      try {
        logToFile('INFO', 'Executing query_logs tool', { query, sources, source_group, data_type, limit });
        
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