import { describe, it, expect } from "vitest";
import { determineDataType } from "../../../src/tools/query-tools.js";

describe("determineDataType Function", () => {
  describe("No Time Filter", () => {
    it("should return union when no filters provided", () => {
      const result = determineDataType();
      expect(result).toBe("union");
    });

    it("should return union when filters exist but no time_filter", () => {
      const filters = {
        raw_contains: "error",
        level: "ERROR" as const,
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });
  });

  describe("Relative Time Filters - All Should Return Union", () => {
    const relativeFilters = [
      "last_30_minutes",
      "last_60_minutes",
      "last_3_hours",
      "last_6_hours",
      "last_12_hours",
      "last_24_hours",
      "last_2_days",
      "last_7_days",
      "last_14_days",
      "last_30_days",
      "everything",
    ] as const;

    relativeFilters.forEach((relative) => {
      it(`should return union for ${relative}`, () => {
        const filters = {
          time_filter: { relative },
        };
        const result = determineDataType(filters);
        expect(result).toBe("union");
      });
    });
  });

  describe("Custom Time Ranges - Recent Data Scenarios", () => {
    it("should return union when time range includes last 24 hours (end time is now)", () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            start_datetime: twentyFourHoursAgo.toISOString(),
            end_datetime: now.toISOString(),
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });

    it("should return union when time range includes recent data (end time within last 24h)", () => {
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            start_datetime: twelveHoursAgo.toISOString(),
            end_datetime: sixHoursAgo.toISOString(),
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });

    it("should return union when start time is old but end time includes recent data", () => {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            start_datetime: oneWeekAgo.toISOString(),
            end_datetime: oneHourAgo.toISOString(),
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });

    it("should return union when end time is exactly at 24 hours ago boundary", () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            start_datetime: fortyEightHoursAgo.toISOString(),
            end_datetime: twentyFourHoursAgo.toISOString(),
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });
  });

  describe("Custom Time Ranges - Historical Only Scenarios", () => {
    it("should return historical when entire time range is before last 24 hours", () => {
      const now = new Date();
      const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            start_datetime: fortyEightHoursAgo.toISOString(),
            end_datetime: twentyFiveHoursAgo.toISOString(),
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("historical");
    });

    it("should return historical for old time ranges (one week ago)", () => {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            start_datetime: oneWeekAgo.toISOString(),
            end_datetime: sixDaysAgo.toISOString(),
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("historical");
    });

    it("should return historical for ancient time ranges (one month ago)", () => {
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const twentyNineDaysAgo = new Date(
        now.getTime() - 29 * 24 * 60 * 60 * 1000
      );

      const filters = {
        time_filter: {
          custom: {
            start_datetime: oneMonthAgo.toISOString(),
            end_datetime: twentyNineDaysAgo.toISOString(),
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("historical");
    });
  });

  describe("Custom Time Ranges - Edge Cases", () => {
    it("should return union when only start_datetime provided (partial range)", () => {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            start_datetime: oneWeekAgo.toISOString(),
            // No end_datetime - implies "from start to now"
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });

    it("should return union when only end_datetime provided and end time is within last 24h", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            end_datetime: oneHourAgo.toISOString(),
            // No start_datetime - implies "from beginning to end"
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });

    it("should return historical when only end_datetime provided and end time is before last 24h", () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const filters = {
        time_filter: {
          custom: {
            end_datetime: twoDaysAgo.toISOString(),
            // No start_datetime - implies "from beginning to end"
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("historical");
    });

    it("should return union when custom time parsing fails (fallback behavior)", () => {
      const filters = {
        time_filter: {
          custom: {
            start_datetime: "invalid-date-format",
            end_datetime: "also-invalid",
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });

    it("should return union when custom object exists but is empty", () => {
      const filters = {
        time_filter: {
          custom: {
            // Empty custom object
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("union");
    });
  });

  describe("Complex Filter Combinations", () => {
    it("should prioritize time_filter over other filters for data type determination", () => {
      const now = new Date();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000);

      const filters = {
        raw_contains: "error",
        level: "ERROR" as const,
        time_filter: {
          custom: {
            start_datetime: fortyEightHoursAgo.toISOString(),
            end_datetime: thirtyHoursAgo.toISOString(),
          },
        },
      };
      const result = determineDataType(filters);
      expect(result).toBe("historical");
    });
  });
});
