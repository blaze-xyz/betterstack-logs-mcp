import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BetterstackClient } from "../../src/betterstack-client.js";
import { createTestConfig } from "../helpers/test-config.js";
import { registerQueryTools } from "../../src/tools/query-tools.js";
import { McpTestHelper } from "../helpers/mcp-test-helper.js";
import {
  determineDataType,
  buildStructuredQuery,
} from "../../src/tools/query-tools.js";
import { Source, DataSourceType, RelativeTimeFilter } from "../../src/types.js";

describe("Query Generation Pipeline Step-by-Step Integration Tests", () => {
  let server: McpServer;
  let client: BetterstackClient;
  let mcpHelper: McpTestHelper;

  beforeEach(() => {
    server = new McpServer({ name: "test-server", version: "1.0.0" });
    client = new BetterstackClient(createTestConfig());
    registerQueryTools(server, client);
    mcpHelper = new McpTestHelper(server);
  });

  it("Single Source Union Pipeline: Step-by-step validation", async () => {
    const params = {
      filters: {
        time_filter: { relative: "last_3_hours" as RelativeTimeFilter },
        raw_contains: ["error"],
        level: "WARN" as const,
      },
      sources: ["Production API Server"], // Single source
      limit: 100,
    };

    // Step 1: Determine data type from filters
    const dataType = determineDataType(params.filters);
    expect(dataType).toBe("union"); // Should be union because last_3_hours includes recent data

    // Step 2: Build structured query
    const structuredQuery = await buildStructuredQuery({
      filters: params.filters,
      limit: params.limit,
      dataType,
      format: "JSONEachRow",
    });
    const expectedStructuredQuery = `SELECT dt, raw FROM union_subquery WHERE (ilike(raw, '%error%')) AND ilike(raw, '%"level":"warn"%') AND dt >= now() - INTERVAL 3 HOUR ORDER BY dt DESC LIMIT 100 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(structuredQuery).toBe(expectedStructuredQuery);

    // Step 3: Execute full pipeline through MCP and verify final SQL and URL
    const result = await mcpHelper.callTool("query_logs", params);
    const responseText = result.content[0].text;

    // Verify the final SQL query format
    const expectedFinalSQL = `SELECT dt, raw FROM (SELECT dt, raw FROM remote(t12345_production_api_logs) UNION DISTINCT SELECT dt, raw FROM s3Cluster(primary, t12345_production_api_s3) WHERE _row_type = 1) WHERE (ilike(raw, '%error%')) AND ilike(raw, '%"level":"warn"%') AND dt >= now() - INTERVAL 3 HOUR ORDER BY dt DESC LIMIT 100 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(responseText).toContain(`Executed SQL: \`${expectedFinalSQL}\``);

    // Step 4: Verify union query URL (no optimization parameters for union queries)
    // Union queries use the base ClickHouse endpoint without additional URL parameters
    const expectedUrl = "https://clickhouse.betterstack.com/";
    expect(responseText).toContain(`Request URL: ${expectedUrl}`);

    // Step 5: Verify that union query URL does NOT contain historical optimization parameters
    // This ensures we're truly using the base URL and not accidentally using historical format
    expect(responseText).not.toContain("range-from=");
    expect(responseText).not.toContain("range-to=");
    expect(responseText).not.toContain("table=");
  });

  it("Single Source Historical Pipeline: Step-by-step validation", async () => {
    const params = {
      filters: {
        time_filter: {
          custom: {
            start_datetime: "2024-01-01T00:00:00Z",
            end_datetime: "2024-01-01T23:59:59Z",
          },
        },
        level: "ERROR" as const,
      },
      sources: ["Frontend Application"], // Single source
      limit: 200,
    };

    // Step 1: Determine data type from filters
    const dataType = determineDataType(params.filters);
    expect(dataType).toBe("historical"); // Should be historical because date range is entirely in the past

    // Step 2: Build structured query
    const structuredQuery = await buildStructuredQuery({
      filters: params.filters,
      limit: params.limit,
      dataType,
      format: "JSONEachRow",
    });
    const expectedStructuredQuery = `SELECT dt, raw FROM logs WHERE ilike(raw, '%"level":"error"%') AND dt >= parseDateTime64BestEffort('2024-01-01T00:00:00Z') AND dt <= parseDateTime64BestEffort('2024-01-01T23:59:59Z') ORDER BY dt DESC LIMIT 200 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(structuredQuery).toBe(expectedStructuredQuery);

    // Step 3: Execute full pipeline through MCP and verify final SQL and URL
    const result = await mcpHelper.callTool("query_logs", params);
    const responseText = result.content[0].text;

    // Verify the final SQL query format
    const expectedFinalSQL = `SELECT dt, raw FROM s3Cluster(primary, t12345_frontend_app_s3, filename='{{_s3_glob_interpolate}}') WHERE _row_type = 1 AND ilike(raw, '%"level":"error"%') AND dt >= parseDateTime64BestEffort('2024-01-01T00:00:00Z') AND dt <= parseDateTime64BestEffort('2024-01-01T23:59:59Z') ORDER BY dt DESC LIMIT 200 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(responseText).toContain(`Executed SQL: \`${expectedFinalSQL}\``);

    // Step 4: Verify historical query optimization URL parameters
    // Historical queries should include URL parameters for optimization
    const expectedUrl =
      "https://clickhouse.betterstack.com/?table=t12345.frontend_app&range-from=1704067200000&range-to=1704153599000";
    expect(responseText).toContain(`Request URL: ${expectedUrl}`);

    // Step 5: Verify timestamp consistency between SQL and URL
    // Validate that the timestamps in the URL match the datetime strings in the SQL query
    const startTimestamp = new Date("2024-01-01T00:00:00Z").getTime(); // Should be 1704067200000
    const endTimestamp = new Date("2024-01-01T23:59:59Z").getTime(); // Should be 1704153599000
    expect(startTimestamp).toBe(1704067200000); // Verify our expected start timestamp is correct
    expect(endTimestamp).toBe(1704153599000); // Verify our expected end timestamp is correct
    expect(responseText).toContain(`range-from=${startTimestamp}`);
    expect(responseText).toContain(`range-to=${endTimestamp}`);
  });

  it("Multi-Source Union Pipeline: Step-by-step validation", async () => {
    const params = {
      filters: {
        time_filter: { relative: "last_6_hours" as RelativeTimeFilter },
        raw_contains: ["api"],
        level: "ERROR" as const,
      },
      sources: ["Production API Server", "Frontend Application"], // Multiple sources
      limit: 75,
    };

    // Step 1: Determine data type from filters
    const dataType = determineDataType(params.filters);
    expect(dataType).toBe("union"); // Should be union because last_6_hours includes recent data

    // Step 2: Build structured query
    const structuredQuery = await buildStructuredQuery({
      filters: params.filters,
      limit: params.limit,
      dataType,
      format: "JSONEachRow",
    });
    const expectedStructuredQuery = `SELECT dt, raw FROM union_subquery WHERE (ilike(raw, '%api%')) AND ilike(raw, '%"level":"error"%') AND dt >= now() - INTERVAL 6 HOUR ORDER BY dt DESC LIMIT 75 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(structuredQuery).toBe(expectedStructuredQuery);

    // Step 3: Execute full pipeline through MCP and verify final SQL and URL
    const result = await mcpHelper.callTool("query_logs", params);
    const responseText = result.content[0].text;

    // Verify the final SQL query format
    const expectedFinalSQL = `SELECT source, dt, raw FROM ((SELECT 'Production API Server' as source, dt, raw FROM remote(t12345_production_api_logs) UNION DISTINCT SELECT 'Production API Server' as source, dt, raw FROM s3Cluster(primary, t12345_production_api_s3) WHERE _row_type = 1) UNION ALL (SELECT 'Frontend Application' as source, dt, raw FROM remote(t12345_frontend_app_logs) UNION DISTINCT SELECT 'Frontend Application' as source, dt, raw FROM s3Cluster(primary, t12345_frontend_app_s3) WHERE _row_type = 1)) WHERE (ilike(raw, '%api%')) AND ilike(raw, '%"level":"error"%') AND dt >= now() - INTERVAL 6 HOUR ORDER BY dt DESC LIMIT 75 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(responseText).toContain(`Executed SQL: \`${expectedFinalSQL}\``);

    // Step 4: Verify union query URL (no optimization parameters for union queries)
    // Multi-source union queries also use the base ClickHouse endpoint without additional URL parameters
    const expectedUrl = "https://clickhouse.betterstack.com/";
    expect(responseText).toContain(`Request URL: ${expectedUrl}`);

    // Step 5: Verify that union query URL does NOT contain historical optimization parameters
    // This ensures we're truly using the base URL and not accidentally using historical format
    expect(responseText).not.toContain("range-from=");
    expect(responseText).not.toContain("range-to=");
    expect(responseText).not.toContain("table=");
  });

  it("Multi-Source Historical Pipeline: Step-by-step validation", async () => {
    const params = {
      filters: {
        time_filter: {
          custom: {
            start_datetime: "2024-02-15T08:00:00Z",
            end_datetime: "2024-02-15T18:00:00Z",
          },
        },
        raw_contains: ["database"],
      },
      sources: ["Production API Server", "Frontend Application"], // Multiple sources
      limit: 150,
    };

    // Step 1: Determine data type from filters
    const dataType = determineDataType(params.filters);
    expect(dataType).toBe("historical"); // Should be historical because date range is entirely in the past

    // Step 2: Build structured query
    const structuredQuery = await buildStructuredQuery({
      filters: params.filters,
      limit: params.limit,
      dataType,
      format: "JSONEachRow",
    });
    const expectedStructuredQuery = `SELECT dt, raw FROM logs WHERE (ilike(raw, '%database%')) AND dt >= parseDateTime64BestEffort('2024-02-15T08:00:00Z') AND dt <= parseDateTime64BestEffort('2024-02-15T18:00:00Z') ORDER BY dt DESC LIMIT 150 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(structuredQuery).toBe(expectedStructuredQuery);

    // Step 3: Execute full pipeline through MCP and verify final SQL and URL
    const result = await mcpHelper.callTool("query_logs", {
      ...params,
      response_format: 'full'
    });
    const responseText = result.content[0].text;

    // Step 4: Verify multi-source optimization was used
    // Multi-source historical queries now use per-source optimization with client-side merging
    expect(responseText).toContain('API used: multi-source-optimized');
    
    // Step 5: Verify both sources are queried (shown in sources_queried)
    expect(responseText).toContain("Sources queried: Production API Server, Frontend Application");
    
    // Step 6: Verify the original structured query is shown (not individual s3Cluster queries)
    // Users see the logical query they requested, not the internal optimization details
    expect(responseText).toContain("SELECT dt, raw FROM logs WHERE");
    expect(responseText).toContain("parseDateTime64BestEffort('2024-02-15T08:00:00Z')");
    expect(responseText).toContain("parseDateTime64BestEffort('2024-02-15T18:00:00Z')");
    expect(responseText).toContain("ilike(raw, '%database%')");
    
    // Step 7: Verify results contain data from both sources
    // Multi-source optimization merges results from all sources
    expect(responseText).toContain("source: Production API Server");
    expect(responseText).toContain("source: Frontend Application");
  });

  it("Source Group Union Pipeline: Step-by-step validation", async () => {
    const params = {
      filters: {
        time_filter: { relative: "last_12_hours" },
        raw_contains: ["service"],
        level: "INFO",
      },
      limit: 120,
      source_group: "Development Environment",
    };

    // Step 1: Call the query_logs tool through MCP protocol
    const result = await mcpHelper.callTool("query_logs", params);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    // Step 2: Extract and verify the response text content
    const responseText = result.content[0].text;
    expect(typeof responseText).toBe("string");
    expect(responseText.length).toBeGreaterThan(0);

    // Step 2a: Build structured query
    const dataType = determineDataType(params);
    const structuredQuery = await buildStructuredQuery({
      filters: {
        time_filter: { relative: "last_12_hours" as RelativeTimeFilter },
        raw_contains: ["service"],
        level: "INFO",
      },
      limit: params.limit,
      dataType,
      format: "JSONEachRow",
    });
    const expectedStructuredQuery = `SELECT dt, raw FROM union_subquery WHERE (ilike(raw, '%service%')) AND ilike(raw, '%"level":"info"%') AND dt >= now() - INTERVAL 12 HOUR ORDER BY dt DESC LIMIT 120 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(structuredQuery).toBe(expectedStructuredQuery);

    // Step 3: Verify the final SQL query format (should include all 3 sources in Development Environment group)
    const expectedFinalSQL = `SELECT source, dt, raw FROM ((SELECT 'Spark - staging | deprecated' as source, dt, raw FROM remote(t12345_spark_staging_logs) UNION DISTINCT SELECT 'Spark - staging | deprecated' as source, dt, raw FROM s3Cluster(primary, t12345_spark_staging_s3) WHERE _row_type = 1) UNION ALL (SELECT 'Frontend Application' as source, dt, raw FROM remote(t12345_frontend_app_logs) UNION DISTINCT SELECT 'Frontend Application' as source, dt, raw FROM s3Cluster(primary, t12345_frontend_app_s3) WHERE _row_type = 1) UNION ALL (SELECT 'Database Service' as source, dt, raw FROM remote(t12345_database_service_logs) UNION DISTINCT SELECT 'Database Service' as source, dt, raw FROM s3Cluster(primary, t12345_database_service_s3) WHERE _row_type = 1)) WHERE (ilike(raw, '%service%')) AND ilike(raw, '%"level":"info"%') AND dt >= now() - INTERVAL 12 HOUR ORDER BY dt DESC LIMIT 120 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(responseText).toContain(`Executed SQL: \`${expectedFinalSQL}\``);

    // Step 4: Verify union query URL (no optimization parameters for union queries)
    // Source group union queries use the base ClickHouse endpoint without additional URL parameters
    const expectedUrl = "https://clickhouse.betterstack.com/";
    expect(responseText).toContain(`Request URL: ${expectedUrl}`);

    // Step 5: Verify that union query URL does NOT contain historical optimization parameters
    // This ensures we're truly using the base URL and not accidentally using historical format
    expect(responseText).not.toContain("range-from=");
    expect(responseText).not.toContain("range-to=");
    expect(responseText).not.toContain("table=");
  });

  it("Source Group Historical Pipeline: Step-by-step validation", async () => {
    const params = {
      filters: {
        time_filter: {
          custom: {
            start_datetime: "2024-03-10T14:30:00Z",
            end_datetime: "2024-03-10T20:15:00Z",
          },
        },
        raw_contains: ["database"],
        level: "WARN",
      },
      limit: 180,
      source_group: "Development Environment",
    };

    // Step 1: Determine data type from filters
    const dataType = determineDataType(params.filters);
    expect(dataType).toBe("historical"); // Should be historical because date range is entirely in the past

    // Step 2: Build structured query
    const structuredQuery = await buildStructuredQuery({
      filters: params.filters,
      limit: params.limit,
      dataType,
      format: "JSONEachRow",
    });
    const expectedStructuredQuery = `SELECT dt, raw FROM logs WHERE (ilike(raw, '%database%')) AND ilike(raw, '%"level":"warn"%') AND dt >= parseDateTime64BestEffort('2024-03-10T14:30:00Z') AND dt <= parseDateTime64BestEffort('2024-03-10T20:15:00Z') ORDER BY dt DESC LIMIT 180 SETTINGS output_format_json_array_of_rows = 1 FORMAT JSONEachRow`;
    expect(structuredQuery).toBe(expectedStructuredQuery);

    // Step 3: Execute full pipeline through MCP and verify final SQL and URL
    const result = await mcpHelper.callTool("query_logs", params);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    // Step 4: Extract and verify the response text content
    const responseText = result.content[0].text;
    expect(typeof responseText).toBe("string");
    expect(responseText.length).toBeGreaterThan(0);

    // Step 5: Verify multi-source optimization was used for source group historical queries
    // Source group historical queries with multiple sources now use per-source optimization
    expect(responseText).toContain('API used: multi-source-optimized');
    
    // Step 6: Verify all sources in the Development Environment group are queried
    expect(responseText).toContain("Spark - staging | deprecated");
    expect(responseText).toContain("Frontend Application");  
    expect(responseText).toContain("Database Service");
    
    // Step 7: Verify the original structured query is shown (not individual s3Cluster queries)
    // Users see the logical query they requested, not the internal optimization details
    expect(responseText).toContain("SELECT dt, raw FROM logs WHERE");
    expect(responseText).toContain("parseDateTime64BestEffort('2024-03-10T14:30:00Z')");
    expect(responseText).toContain("parseDateTime64BestEffort('2024-03-10T20:15:00Z')");
    expect(responseText).toContain("ilike(raw, '%database%')");
    expect(responseText).toContain('ilike(raw, \'%"level":"warn"%\')');
    
    // Step 8: Verify results contain data from all sources in the group
    // Multi-source optimization merges results from all sources in the group
  });
});
