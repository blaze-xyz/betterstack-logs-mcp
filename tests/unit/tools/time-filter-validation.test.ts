import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BetterstackClient } from "../../../src/betterstack-client.js";
import { createTestConfig } from "../../helpers/test-config.js";
import { registerQueryTools } from "../../../src/tools/query-tools.js";
import { McpTestHelper } from "../../helpers/mcp-test-helper.js";

describe("Time Filter Validation", () => {
  let server: McpServer;
  let client: BetterstackClient;
  let mcpHelper: McpTestHelper;

  beforeEach(() => {
    server = new McpServer({ name: "test-server", version: "1.0.0" });
    client = new BetterstackClient(createTestConfig());
    registerQueryTools(server, client);
    mcpHelper = new McpTestHelper(server);
  });

  // Helper function to get tool info
  function getTool(name: string) {
    const tools = (server as any)._registeredTools;
    if (tools instanceof Map) {
      return tools.get(name);
    } else if (typeof tools === "object") {
      return tools[name];
    }
    return null;
  }

  describe("query_logs tool schema validation", () => {
    it("should accept relative time filter only", async () => {
      const validParams = {
        filters: {
          time_filter: {
            relative: "last_30_minutes",
          },
        },
        limit: 10,
      };

      const tool = getTool("query_logs");
      expect(tool).toBeDefined();

      // Validate the parameters against the schema
      const parseResult = tool.inputSchema.safeParse(validParams);
      expect(parseResult.success).toBe(true);
    });

    it("should accept custom time filter only", async () => {
      const validParams = {
        filters: {
          time_filter: {
            custom: {
              start_datetime: "2024-07-28T10:00:00Z",
              end_datetime: "2024-07-28T12:00:00Z",
            },
          },
        },
        limit: 10,
      };

      const tool = getTool("query_logs");
      const parseResult = tool.inputSchema.safeParse(validParams);
      expect(parseResult.success).toBe(true);
    });

    it("should accept no time filter", async () => {
      const validParams = {
        filters: {
          raw_contains: "error",
          level: "ERROR",
        },
        limit: 10,
      };

      const tool = getTool("query_logs");
      const parseResult = tool.inputSchema.safeParse(validParams);
      expect(parseResult.success).toBe(true);
    });

    it("should reject both relative and custom time filters", async () => {
      const invalidParams = {
        filters: {
          time_filter: {
            relative: "last_30_minutes",
            custom: {
              start_datetime: "2024-07-28T10:00:00Z",
              end_datetime: "2024-07-28T12:00:00Z",
            },
          },
        },
        limit: 10,
      };

      const tool = getTool("query_logs");
      const parseResult = tool.inputSchema.safeParse(invalidParams);

      expect(parseResult.success).toBe(false);
      expect(parseResult.error?.issues[0]?.message).toContain(
        "Cannot specify both 'relative' and 'custom' time filters"
      );
    });

    it("should provide clear error message for invalid combination", async () => {
      const invalidParams = {
        filters: {
          time_filter: {
            relative: "last_6_hours",
            custom: {
              start_datetime: "2024-01-01T00:00:00Z",
              end_datetime: "2024-01-01T06:00:00Z",
            },
          },
        },
        limit: 25,
      };

      const tool = getTool("query_logs");
      const parseResult = tool.inputSchema.safeParse(invalidParams);

      expect(parseResult.success).toBe(false);

      const errorMessage = parseResult.error?.issues[0]?.message;
      expect(errorMessage).toBe(
        "Cannot specify both 'relative' and 'custom' time filters. Use either relative (e.g., 'last_30_minutes') or custom (with start_datetime/end_datetime), not both."
      );
    });

    it("should allow empty time_filter object", async () => {
      const validParams = {
        filters: {
          time_filter: {},
          raw_contains: "info",
        },
        limit: 10,
      };

      const tool = getTool("query_logs");
      const parseResult = tool.inputSchema.safeParse(validParams);
      expect(parseResult.success).toBe(true);
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should reject partial custom with relative", async () => {
      const invalidParams = {
        filters: {
          time_filter: {
            relative: "everything",
            custom: {
              start_datetime: "2024-07-28T10:00:00Z",
              end_datetime: "2024-07-28T12:00:00Z",
              // Valid custom object, but shouldn't be combined with relative
            },
          },
        },
        limit: 10,
      };

      const tool = getTool("query_logs");
      const parseResult = tool.inputSchema.safeParse(invalidParams);

      expect(parseResult.success).toBe(false);
      expect(parseResult.error?.issues[0]?.message).toContain(
        "Cannot specify both 'relative' and 'custom' time filters"
      );
    });
  });
});
