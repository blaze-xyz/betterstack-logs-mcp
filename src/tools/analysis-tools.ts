import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BetterstackClient } from '../betterstack-client.js';
import { QueryOptions } from '../types.js';

export function registerAnalysisTools(server: McpServer, client: BetterstackClient) {

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