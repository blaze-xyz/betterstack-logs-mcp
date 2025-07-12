import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { stringify as csvStringify } from 'csv-stringify/sync';
import { BetterstackClient } from '../betterstack-client.js';
import { QueryOptions } from '../types.js';

export function registerAnalysisTools(server: McpServer, client: BetterstackClient) {
  
  // Analyze error patterns in logs
  server.tool(
    "analyze_errors",
    {
      sources: z.array(z.string()).optional().describe("Specific source IDs or names to analyze (optional)"),
      source_group: z.string().optional().describe("Source group name to analyze (optional)"),
      time_range_hours: z.number().optional().describe("Number of hours back to analyze (default: 24)"),
      error_terms: z.array(z.string()).optional().describe("Custom error terms to search for (default: ['error', 'exception', 'failed'])"),
      limit: z.number().optional().describe("Maximum number of error patterns to return (default: 50)")
    },
    async ({ sources, source_group, time_range_hours, error_terms, limit }) => {
      try {
        const hours = time_range_hours || 24;
        const maxResults = limit || 50;
        const errorKeywords = error_terms || ['error', 'exception', 'failed', 'fatal', 'critical'];
        
        // Build query to find errors
        const errorConditions = errorKeywords.map(term => 
          `lower(raw) LIKE '%${term.toLowerCase()}%'`
        ).join(' OR ');
        
        const query = `
          SELECT 
            dt, 
            raw,
            COUNT(*) OVER (PARTITION BY substring(raw, 1, 100)) as similar_count
          FROM logs 
          WHERE (${errorConditions})
            AND dt >= now() - INTERVAL ${hours} HOUR 
          ORDER BY similar_count DESC, dt DESC
        `;

        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: 'recent',
          limit: maxResults * 2 // Get more to group similar errors
        };

        const result = await client.executeQuery(query, options);
        
        const resultText = [
          `**Error Analysis Report**`,
          `Time range: Last ${hours} hours`,
          `Sources analyzed: ${result.meta?.sources_queried?.join(', ') || 'default'}`,
          `Error patterns searched: ${errorKeywords.join(', ')}`,
          `Total errors found: ${result.data.length}`,
          ''
        ];

        if (result.data.length === 0) {
          resultText.push('No errors found matching the specified criteria.');
          resultText.push('This could indicate:');
          resultText.push('• No errors occurred in the time range');
          resultText.push('• Errors are logged with different terminology');
          resultText.push('• The sources may not contain error logs');
        } else {
          // Group similar errors
          const errorGroups = new Map<string, any[]>();
          
          result.data.forEach((log: any) => {
            // Create a simple key for grouping based on first 100 chars
            const key = log.raw.substring(0, 100).toLowerCase()
              .replace(/\d+/g, 'N')  // Replace numbers with N
              .replace(/\b\w{32,}\b/g, 'ID'); // Replace long strings with ID
            
            if (!errorGroups.has(key)) {
              errorGroups.set(key, []);
            }
            errorGroups.get(key)!.push(log);
          });

          // Sort groups by frequency
          const sortedGroups = Array.from(errorGroups.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 10);

          resultText.push('**Top Error Patterns:**');
          resultText.push('');

          sortedGroups.forEach(([pattern, logs], index) => {
            const firstLog = logs[0];
            const timestamp = new Date(firstLog.dt).toLocaleString();
            const count = logs.length;
            const sample = firstLog.raw.length > 200 ? 
              firstLog.raw.substring(0, 200) + '...' : 
              firstLog.raw;
            
            resultText.push(`**${index + 1}. Error Pattern (${count} occurrence${count > 1 ? 's' : ''})**`);
            resultText.push(`Latest: ${timestamp}`);
            resultText.push(`Sample: ${sample}`);
            resultText.push('');
          });

          if (errorGroups.size > 10) {
            resultText.push(`... and ${errorGroups.size - 10} more error patterns`);
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
              text: `❌ Error analysis failed: ${error}`
            }
          ]
        };
      }
    }
  );

  // Export logs in various formats
  server.tool(
    "export_logs",
    {
      query: z.string().describe("ClickHouse SQL query to export data"),
      format: z.enum(['json', 'csv']).describe("Export format (json or csv)"),
      sources: z.array(z.string()).optional().describe("Specific source IDs or names (optional)"),
      source_group: z.string().optional().describe("Source group name (optional)"),
      data_type: z.enum(['recent', 'historical', 'metrics']).optional().describe("Type of data to export (default: recent)"),
      limit: z.number().optional().describe("Maximum number of records to export (default: 1000)")
    },
    async ({ query, format, sources, source_group, data_type, limit }) => {
      try {
        const maxResults = Math.min(limit || 1000, 5000); // Cap at 5000 for safety
        
        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: data_type as any || 'recent',
          limit: maxResults
        };

        const result = await client.executeQuery(query, options);
        
        if (result.data.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No data found to export."
              }
            ]
          };
        }

        let exportData: string;
        let mimeType: string;
        
        if (format === 'csv') {
          exportData = csvStringify(result.data, { 
            header: true,
            quoted: true 
          });
          mimeType = 'text/csv';
        } else {
          exportData = JSON.stringify({
            meta: result.meta,
            data: result.data
          }, null, 2);
          mimeType = 'application/json';
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `betterstack-export-${timestamp}.${format}`;

        return {
          content: [
            {
              type: "text",
              text: `**Export Complete**\n\n` +
                    `Records exported: ${result.data.length}\n` +
                    `Format: ${format.toUpperCase()}\n` +
                    `Sources: ${result.meta?.sources_queried?.join(', ') || 'default'}\n` +
                    `Filename: ${filename}\n\n` +
                    `**Preview (first 500 characters):**\n` +
                    `\`\`\`${format}\n${exportData.substring(0, 500)}${exportData.length > 500 ? '...' : ''}\n\`\`\``
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Export failed: ${error}`
            }
          ]
        };
      }
    }
  );

  // Log statistics and summary
  server.tool(
    "get_log_statistics",
    {
      sources: z.array(z.string()).optional().describe("Specific source IDs or names (optional)"),
      source_group: z.string().optional().describe("Source group name (optional)"),
      time_range_hours: z.number().optional().describe("Number of hours back to analyze (default: 24)")
    },
    async ({ sources, source_group, time_range_hours }) => {
      try {
        const hours = time_range_hours || 24;
        
        // Query for basic statistics
        const statsQuery = `
          SELECT 
            COUNT(*) as total_logs,
            COUNT(DISTINCT DATE(dt)) as days_with_logs,
            MIN(dt) as earliest_log,
            MAX(dt) as latest_log,
            AVG(length(raw)) as avg_message_length
          FROM logs 
          WHERE dt >= now() - INTERVAL ${hours} HOUR
        `;

        // Query for hourly distribution
        const distributionQuery = `
          SELECT 
            toHour(dt) as hour,
            COUNT(*) as log_count
          FROM logs 
          WHERE dt >= now() - INTERVAL ${hours} HOUR
          GROUP BY hour
          ORDER BY hour
        `;

        const options: QueryOptions = {
          sources,
          sourceGroup: source_group,
          dataType: 'recent'
        };

        const [statsResult, distributionResult] = await Promise.all([
          client.executeQuery(statsQuery, options),
          client.executeQuery(distributionQuery, options)
        ]);

        const stats = statsResult.data[0] as any;
        const distribution = distributionResult.data as any[];

        const resultText = [
          `**Log Statistics**`,
          `Time range: Last ${hours} hours`,
          `Sources: ${statsResult.meta?.sources_queried?.join(', ') || 'default'}`,
          '',
          `**Summary:**`,
          `Total logs: ${stats?.total_logs || 0}`,
          `Average message length: ${stats?.avg_message_length ? Math.round(stats.avg_message_length) + ' characters' : 'N/A'}`,
          `Earliest log: ${stats?.earliest_log ? new Date(stats.earliest_log).toLocaleString() : 'N/A'}`,
          `Latest log: ${stats?.latest_log ? new Date(stats.latest_log).toLocaleString() : 'N/A'}`,
          ''
        ];

        if (distribution.length > 0) {
          resultText.push('**Hourly Distribution:**');
          distribution.forEach(row => {
            const hourStr = String(row.hour).padStart(2, '0') + ':00';
            const count = row.log_count;
            const bar = '█'.repeat(Math.min(Math.floor(count / 100), 20));
            resultText.push(`${hourStr}: ${count} logs ${bar}`);
          });
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
              text: `❌ Failed to get log statistics: ${error}`
            }
          ]
        };
      }
    }
  );
}