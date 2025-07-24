import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BetterstackClient } from '../betterstack-client.js';

export function registerSourceManagementTools(server: McpServer, client: BetterstackClient) {
  
  // List all available sources
  server.tool(
    "list_sources",
    {},
    async () => {
      try {
        const sources = await client.listSources();
        
        if (sources.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No sources found. This could mean:\n" +
                      "1. No logs have been configured in Betterstack\n" +
                      "2. API endpoint for listing sources is not available\n" +
                      "3. Authentication issues"
              }
            ]
          };
        }

        const sourceList = sources.map(source => 
          `• **${source.name}** (ID: ${source.id})` +
          (source.platform ? ` - Platform: ${source.platform}` : '') +
          (source.retention_days ? ` - Retention: ${source.retention_days} days` : '')
        ).join('\n');

        return {
          content: [
            {
              type: "text",
              text: `**Available Log Sources (${sources.length}):**\n\n${sourceList}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to list sources: ${error}`
            }
          ]
        };
      }
    }
  );

  // List all source groups
  server.tool(
    "list_source_groups",
    {},
    async () => {
      try {
        const groups = await client.listSourceGroups();
        
        if (groups.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No source groups found. This could mean:\n" +
                      "1. No source groups have been created in your Betterstack dashboard\n" +
                      "2. You may need a Team API token instead of an individual token\n" +
                      "3. Check your Betterstack settings → API tokens → Telemetry API tokens section\n\n" +
                      "Source groups are logical collections of sources that you can create in your dashboard."
              }
            ]
          };
        }

        const groupList = groups.map(group => 
          `• **${group.name}** (ID: ${group.id})\n` +
          `  Sources: ${group.source_ids.length} source(s) - ${group.source_ids.join(', ')}`
        ).join('\n\n');

        return {
          content: [
            {
              type: "text",
              text: `**Available Source Groups (${groups.length}):**\n\n${groupList}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to list source groups: ${error}`
            }
          ]
        };
      }
    }
  );

  // Get detailed information about a specific source
  server.tool(
    "get_source_info",
    {
      source_id: z.string().describe("The ID or name of the source to get information about")
    },
    async ({ source_id }) => {
      try {
        const source = await client.getSourceInfo(source_id);
        
        if (!source) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Source not found: ${source_id}\n\nUse the 'list_sources' tool to see available sources.`
              }
            ]
          };
        }

        const details = [
          `**Source: ${source.name}**`,
          `ID: ${source.id}`,
          source.platform ? `Platform: ${source.platform}` : null,
          source.retention_days ? `Retention: ${source.retention_days} days` : null,
          source.created_at ? `Created: ${new Date(source.created_at).toLocaleDateString()}` : null,
          source.updated_at ? `Updated: ${new Date(source.updated_at).toLocaleDateString()}` : null
        ].filter(Boolean).join('\n');

        return {
          content: [
            {
              type: "text",
              text: details
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to get source info: ${error}`
            }
          ]
        };
      }
    }
  );

  // Get detailed information about a specific source group
  server.tool(
    "get_source_group_info",
    {
      group_name: z.string().describe("The name of the source group to get information about")
    },
    async ({ group_name }) => {
      try {
        const groupInfo = await client.getSourceGroupInfo(group_name);
        
        if (!groupInfo) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Source group not found: ${group_name}\n\nUse the 'list_source_groups' tool to see available groups.`
              }
            ]
          };
        }

        const sourceDetails = groupInfo.sources.map(source => 
          `  • **${source.name}** (ID: ${source.id})` +
          (source.platform ? ` - ${source.platform}` : '') +
          (source.retention_days ? ` - ${source.retention_days} days retention` : '')
        ).join('\n');

        const details = [
          `**Source Group: ${groupInfo.name}**`,
          `ID: ${groupInfo.id}`,
          `Total Sources: ${groupInfo.total_sources}`,
          groupInfo.aggregate_retention_days ? `Minimum Retention: ${groupInfo.aggregate_retention_days} days` : null,
          groupInfo.created_at ? `Created: ${new Date(groupInfo.created_at).toLocaleDateString()}` : null,
          '',
          '**Included Sources:**',
          sourceDetails || '  (No sources found)'
        ].filter(line => line !== null).join('\n');

        return {
          content: [
            {
              type: "text",
              text: details
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to get source group info: ${error}`
            }
          ]
        };
      }
    }
  );

  // Test connection to both Telemetry API and ClickHouse
  server.tool(
    "test_connection",
    {},
    async () => {
      try {
        const isConnected = await client.testConnection();
        return {
          content: [
            {
              type: "text",
              text: isConnected 
                ? "✅ Connection successful - both Telemetry API and ClickHouse are accessible"
                : "❌ Connection failed - check your API token and network connectivity"
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Connection test failed: ${error}`
            }
          ]
        };
      }
    }
  );
}