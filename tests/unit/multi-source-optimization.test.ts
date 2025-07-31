import { describe, it, expect, beforeEach, vi } from "vitest";
import { BetterstackClient } from "../../src/betterstack-client";
import { Source } from "../../src/types";
import { createTestConfig } from "../helpers/test-config";

describe("Multi-Source Optimization", () => {
  let client: BetterstackClient;
  let mockSources: (Source & { table_name: string; team_id: number })[];

  beforeEach(() => {
    client = new BetterstackClient(createTestConfig());
    
    // Create mock sources for testing
    mockSources = [
      {
        id: "source1",
        name: "Source 1",
        platform: "ubuntu",
        retention_days: 30,
        table_name: "t123_source1_logs",
        team_id: 123,
      },
      {
        id: "source2", 
        name: "Source 2",
        platform: "ubuntu",
        retention_days: 30,
        table_name: "t123_source2_logs", 
        team_id: 123,
      }
    ];
  });

  describe("Multi-source historical query routing", () => {
    it("should route to multi-source optimization for multiple sources with historical data type", async () => {
      // Mock the executeMultiSourceHistoricalQuery method to track if it was called
      const executeMultiSourceSpy = vi.spyOn(client as any, "executeMultiSourceHistoricalQuery");
      executeMultiSourceSpy.mockResolvedValue({
        data: [{ dt: "2025-07-28T13:00:00Z", raw: "Test log" }],
        meta: {
          total_rows: 1,
          sources_queried: ["Source 1", "Source 2"],
          api_used: "multi-source-optimized",
        },
      });

      // Mock the buildMultiSourceQuery method
      const buildQuerySpy = vi.spyOn(client, "buildMultiSourceQuery");
      buildQuerySpy.mockReturnValue("SELECT dt, raw FROM logs");

      const query = "SELECT dt, raw FROM logs WHERE level = 'ERROR'";
      const options = {
        sources: ["source1", "source2"],
        dataType: "historical" as const,
        rawFilters: {
          time_filter: {
            custom: {
              start_datetime: "2025-07-28T12:30:00Z",
              end_datetime: "2025-07-29T18:45:00Z"
            }
          }
        },
        limit: 50,
      };

      // Call the executeClickHouseQuery method directly with mock sources
      const result = await (client as any).executeClickHouseQuery(
        query,
        mockSources,
        "historical",
        options
      );

      // Verify that multi-source optimization was triggered
      expect(executeMultiSourceSpy).toHaveBeenCalledWith(
        expect.stringContaining("SELECT dt, raw FROM logs"),
        mockSources,
        options
      );

      expect(result.meta?.api_used).toBe("multi-source-optimized");
      expect(result.meta?.sources_queried).toEqual(["Source 1", "Source 2"]);
      
      executeMultiSourceSpy.mockRestore();
      buildQuerySpy.mockRestore();
    });

    it("should not route to multi-source optimization for single source", async () => {
      const executeMultiSourceSpy = vi.spyOn(client as any, "executeMultiSourceHistoricalQuery");
      
      // Mock the regular API request
      const mockPost = vi.fn().mockResolvedValue({
        data: { data: [{ dt: "2025-07-28T13:00:00Z", raw: "Test log" }] }
      });
      (client as any).queryClient.post = mockPost;

      const query = "SELECT dt, raw FROM logs WHERE level = 'ERROR'";
      const singleSource = [mockSources[0]];
      const options = {
        sources: ["source1"],
        dataType: "historical" as const,
        rawFilters: {
          time_filter: {
            custom: {
              start_datetime: "2025-07-28T12:30:00Z",
              end_datetime: "2025-07-29T18:45:00Z"
            }
          }
        },
        limit: 50,
      };

      await (client as any).executeClickHouseQuery(
        query,
        singleSource,
        "historical",
        options
      );

      // Verify that multi-source optimization was NOT triggered
      expect(executeMultiSourceSpy).not.toHaveBeenCalled();
      
      executeMultiSourceSpy.mockRestore();
    });

    it("should not route to multi-source optimization for recent data type", async () => {
      const executeMultiSourceSpy = vi.spyOn(client as any, "executeMultiSourceHistoricalQuery");
      
      // Mock the regular API request
      const mockPost = vi.fn().mockResolvedValue({
        data: { data: [{ dt: "2025-07-28T13:00:00Z", raw: "Test log" }] }
      });
      (client as any).queryClient.post = mockPost;

      const query = "SELECT dt, raw FROM logs WHERE level = 'ERROR'";
      const options = {
        sources: ["source1", "source2"],
        dataType: "recent" as const,
        limit: 50,
      };

      await (client as any).executeClickHouseQuery(
        query,
        mockSources,
        "recent",
        options
      );

      // Verify that multi-source optimization was NOT triggered for recent data
      expect(executeMultiSourceSpy).not.toHaveBeenCalled();
      
      executeMultiSourceSpy.mockRestore();
    });
  });

  describe("executeMultiSourceHistoricalQuery", () => {
    it("should execute parallel optimized requests for each source", async () => {
      // Mock the buildMultiSourceQuery method
      const buildQuerySpy = vi.spyOn(client, "buildMultiSourceQuery");
      buildQuerySpy.mockImplementation((query, sources) => {
        const source = sources[0];
        return `SELECT dt, raw FROM s3Cluster(primary, t${source.team_id}_${source.table_name}_s3, filename='{{_s3_glob_interpolate}}') WHERE _row_type = 1`;
      });

      // Mock the rate limiter and HTTP client
      const mockPost = vi.fn()
        .mockResolvedValueOnce({
          data: { data: [{ dt: "2025-07-28T13:00:00Z", raw: "Log from source 1" }] }
        })
        .mockResolvedValueOnce({
          data: { data: [{ dt: "2025-07-28T15:00:00Z", raw: "Log from source 2" }] }
        });
      
      (client as any).queryClient.post = mockPost;
      (BetterstackClient as any).rateLimiter = (fn: () => any) => fn();

      const query = "SELECT dt, raw FROM logs WHERE level = 'ERROR'";
      const options = {
        rawFilters: {
          time_filter: {
            custom: {
              start_datetime: "2025-07-28T12:30:00Z",
              end_datetime: "2025-07-29T18:45:00Z"
            }
          }
        },
        limit: 50,
      };

      const result = await (client as any).executeMultiSourceHistoricalQuery(
        query,
        mockSources,
        options
      );

      // Verify that both sources were queried
      expect(mockPost).toHaveBeenCalledTimes(2);
      
      // Verify the result structure
      expect(result.data).toHaveLength(2);
      expect(result.meta?.api_used).toBe("multi-source-optimized");
      expect(result.meta?.sources_queried).toEqual(["Source 1", "Source 2"]);
      expect(result.meta?._multiSourceStats?.successfulSources).toBe(2);
      expect(result.meta?._multiSourceStats?.totalSources).toBe(2);

      // Verify results are sorted by timestamp (descending)
      expect(new Date(result.data[0].dt).getTime()).toBeGreaterThan(
        new Date(result.data[1].dt).getTime()
      );
      
      buildQuerySpy.mockRestore();
    });

    it("should handle partial failures gracefully", async () => {
      // Mock the buildMultiSourceQuery method
      const buildQuerySpy = vi.spyOn(client, "buildMultiSourceQuery");
      buildQuerySpy.mockImplementation(() => "SELECT dt, raw FROM logs");

      // Mock one successful and one failed request
      const mockPost = vi.fn()
        .mockResolvedValueOnce({
          data: { data: [{ dt: "2025-07-28T13:00:00Z", raw: "Success log" }] }
        })
        .mockRejectedValueOnce(new Error("Source 2 failed"));
      
      (client as any).queryClient.post = mockPost;
      (BetterstackClient as any).rateLimiter = (fn: () => any) => fn();

      const query = "SELECT dt, raw FROM logs WHERE level = 'ERROR'";
      const options = { limit: 50 };

      const result = await (client as any).executeMultiSourceHistoricalQuery(
        query,
        mockSources,
        options
      );

      // Verify that one source succeeded and one failed
      expect(result.data).toHaveLength(1);
      expect(result.meta?.sources_queried).toEqual(["Source 1"]);
      expect(result.meta?._multiSourceStats?.successfulSources).toBe(1);
      expect(result.meta?._multiSourceStats?.totalSources).toBe(2);
      expect(result.meta?._failedSources).toHaveLength(1);
      expect(result.meta?._failedSources?.[0].source).toBe("Source 2");
      
      buildQuerySpy.mockRestore();
    });

    it("should deduplicate results based on dt + raw combination", async () => {
      // Mock the buildMultiSourceQuery method
      const buildQuerySpy = vi.spyOn(client, "buildMultiSourceQuery");
      buildQuerySpy.mockImplementation(() => "SELECT dt, raw FROM logs");

      // Mock responses with duplicate entries
      const mockPost = vi.fn()
        .mockResolvedValueOnce({
          data: { 
            data: [
              { dt: "2025-07-28T13:00:00Z", raw: "Duplicate log" },
              { dt: "2025-07-28T14:00:00Z", raw: "Unique log 1" }
            ] 
          }
        })
        .mockResolvedValueOnce({
          data: { 
            data: [
              { dt: "2025-07-28T13:00:00Z", raw: "Duplicate log" },  // Same as first source
              { dt: "2025-07-28T15:00:00Z", raw: "Unique log 2" }
            ] 
          }
        });
      
      (client as any).queryClient.post = mockPost;
      (BetterstackClient as any).rateLimiter = (fn: () => any) => fn();

      const query = "SELECT dt, raw FROM logs";
      const options = { limit: 50 };

      const result = await (client as any).executeMultiSourceHistoricalQuery(
        query,
        mockSources,
        options
      );

      // Verify deduplication - should have 3 unique entries, not 4
      expect(result.data).toHaveLength(3);
      
      // Verify all unique combinations are present
      const logMessages = result.data.map((entry: any) => entry.raw);
      expect(logMessages).toContain("Duplicate log");
      expect(logMessages).toContain("Unique log 1");
      expect(logMessages).toContain("Unique log 2");
      
      buildQuerySpy.mockRestore();
    });

    it("should apply limit after merging and sorting", async () => {
      // Mock the buildMultiSourceQuery method
      const buildQuerySpy = vi.spyOn(client, "buildMultiSourceQuery");
      buildQuerySpy.mockImplementation(() => "SELECT dt, raw FROM logs");

      // Mock responses with multiple entries
      const mockPost = vi.fn()
        .mockResolvedValueOnce({
          data: { 
            data: [
              { dt: "2025-07-28T13:00:00Z", raw: "Log 1" },
              { dt: "2025-07-28T14:00:00Z", raw: "Log 2" }
            ] 
          }
        })
        .mockResolvedValueOnce({
          data: { 
            data: [
              { dt: "2025-07-28T15:00:00Z", raw: "Log 3" },
              { dt: "2025-07-28T16:00:00Z", raw: "Log 4" }
            ] 
          }
        });
      
      (client as any).queryClient.post = mockPost;
      (BetterstackClient as any).rateLimiter = (fn: () => any) => fn();

      const query = "SELECT dt, raw FROM logs";
      const options = { limit: 3 };  // Limit to 3 entries

      const result = await (client as any).executeMultiSourceHistoricalQuery(
        query,
        mockSources,
        options
      );

      // Verify limit was applied after merging
      expect(result.data).toHaveLength(3);
      
      // Verify results are sorted by timestamp (descending) and limited
      expect(result.data[0].raw).toBe("Log 4");  // Most recent
      expect(result.data[1].raw).toBe("Log 3");
      expect(result.data[2].raw).toBe("Log 2");
      // Log 1 should be excluded due to limit
      
      buildQuerySpy.mockRestore();
    });
  });
});