# BetterStack Logs MCP - Manual Testing Checklist

This checklist covers comprehensive testing of the `query_logs` tool via Postman using source ID `1386515`.

## Test Progress Tracker

- [ ] **JSON Field Extraction Tests** (3 tests)
- [ ] **Raw Content Filtering Tests** (2 tests)
- [ ] **Log Level Filtering Tests** (3 tests)
- [ ] **Time Range Filtering Tests** (5 tests)
- [ ] **JSON Field Filtering Tests** (3 tests)
- [ ] **Combined Filter Tests** (3 tests)
- [ ] **Limit Testing** (2 tests)
- [ ] **Complex Real-World Scenarios** (3 tests)
- [ ] **Output Format Testing** (5 tests)

---

## 1. JSON Field Extraction Tests

### [x] Test 1.1: Extract JSON field with default alias

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "json_fields": [{ "path": "level" }],
      "sources": ["1386515"],
      "limit": 5
    }
  }
}
```

**Expected**: Should extract level field from JSON with default alias
**Result**: ✅ / ❌
**Notes**:

### [x] Test 1.2: Extract JSON field with custom alias

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "json_fields": [{ "path": "level", "alias": "log_level" }],
      "sources": ["1386515"],
      "limit": 5
    }
  }
}
```

**Expected**: Should extract level field with custom alias "log_level"
**Result**: ✅ / ❌
**Notes**:

### [x] Test 1.3: Extract multiple nested JSON fields

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "json_fields": [
        { "path": "level", "alias": "log_level" },
        { "path": "message", "alias": "msg" },
        { "path": "context.hostname", "alias": "host" },
        { "path": "user.id", "alias": "user_id" }
      ],
      "sources": ["1386515"],
      "limit": 5
    }
  }
}
```

**Expected**: Should extract multiple nested JSON fields with aliases
**Result**: ✅ / ❌
**Notes**:

---

## 2. Raw Content Filtering Tests

### [x] Test 2.1: Simple substring search

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "raw_contains": "error"
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs containing "error" in raw field
**Result**: ✅ / ❌
**Notes**:

### [x] Test 2.2: Search for specific patterns

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "raw_contains": "HTTP 500"
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs containing "HTTP 500" pattern
**Result**: ✅ / ❌
**Notes**:

---

## 3. Log Level Filtering Tests

### [x] Test 3.1: Filter by ERROR level

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "level": "ERROR"
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return only ERROR level logs
**Result**: ✅ / ❌
**Notes**:

### [x] Test 3.2: Filter by INFO level

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "level": "INFO"
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return only INFO level logs
**Result**: ✅ / ❌
**Notes**:

### [x] Test 3.3: Filter by WARN level

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "level": "WARN"
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return only WARN level logs
**Result**: ✅ / ❌
**Notes**:

---

## 4. Time Range Filtering Tests

### [x] Test 4.1: Last hour

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "time_range": {
          "last": "1h"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs from last 1 hour
**Result**: ✅ / ❌
**Notes**:

### [x] Test 4.2: Last 30 minutes

```json
{
  "jsonrpc": "2.0",
  "id": 13,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "time_range": {
          "last": "30m"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs from last 30 minutes
**Result**: ✅ / ❌
**Notes**: It was hard to test with 30 minutes, but setting it to 4 confirmed that the logs truncate according to the time filter.

### [ ] Test 4.3: Specific time range with start and end

```json
{
  "jsonrpc": "2.0",
  "id": 14,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "time_range": {
          "start": "2024-01-15T10:00:00",
          "end": "2024-01-15T12:00:00"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs between specified start and end times
**Result**: ✅ / ❌
**Notes**:

### [x] Test 4.5: Start and end with ISO timestamps

```json
{
  "jsonrpc": "2.0",
  "id": 15,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "time_range": {
          "start": "2025-07-28T10:00:00Z",
          "end": "2025-07-28T12:00:00Z"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs between ISO timestamps 2024-07-28T10:00:00Z and 2024-07-28T12:00:00Z
**Result**: ✅ / ❌
**Notes**:

### [x] Test 4.4: Relative start time

```json
{
  "jsonrpc": "2.0",
  "id": 16,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "time_range": {
          "start": "2 hours ago"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs from 2 hours ago onwards
**Result**: ✅ / ❌
**Notes**: SQL query basically compiles down to the equivalent we'd have if we did "last 2 hours"

---

## 5. JSON Field Filtering Tests

### [ ] Test 5.1: Filter by user ID

```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "json_field": {
          "path": "user.id",
          "value": "12345"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs where user.id = "12345"
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 5.2: Filter by request method

```json
{
  "jsonrpc": "2.0",
  "id": 18,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "json_field": {
          "path": "request.method",
          "value": "POST"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs where request.method = "POST"
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 5.3: Filter by nested JSON field

```json
{
  "jsonrpc": "2.0",
  "id": 19,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "json_field": {
          "path": "context.environment",
          "value": "production"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs where context.environment = "production"
**Result**: ✅ / ❌
**Notes**:

---

## 6. Combined Filter Tests

### [ ] Test 6.1: Multiple filters combined

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "raw_contains": "error",
        "level": "ERROR",
        "time_range": {
          "last": "1h"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return ERROR level logs containing "error" from last hour
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 6.2: Raw content + JSON field filtering

```json
{
  "jsonrpc": "2.0",
  "id": 21,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "filters": {
        "raw_contains": "HTTP",
        "json_field": {
          "path": "status",
          "value": "500"
        }
      },
      "sources": ["1386515"],
      "limit": 10
    }
  }
}
```

**Expected**: Should return logs containing "HTTP" with status = "500"
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 6.3: Level + time range + JSON extraction

```json
{
  "jsonrpc": "2.0",
  "id": 22,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "json_fields": [
        { "path": "user.id", "alias": "user" },
        { "path": "request.duration", "alias": "duration" }
      ],
      "filters": {
        "level": "INFO",
        "time_range": {
          "last": "30m"
        }
      },
      "sources": ["1386515"],
      "limit": 15
    }
  }
}
```

**Expected**: Should return INFO logs from last 30m with extracted user and duration fields
**Result**: ✅ / ❌
**Notes**:

---

## 7. Limit Testing

### [ ] Test 7.1: Small limit

```json
{
  "jsonrpc": "2.0",
  "id": 23,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "sources": ["1386515"],
      "limit": 1
    }
  }
}
```

**Expected**: Should return exactly 1 log entry
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 7.2: Large limit

```json
{
  "jsonrpc": "2.0",
  "id": 24,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "sources": ["1386515"],
      "limit": 100
    }
  }
}
```

**Expected**: Should return up to 100 log entries
**Result**: ✅ / ❌
**Notes**:

---

## 8. Complex Real-World Scenarios

### [ ] Test 8.1: Debug login issues

```json
{
  "jsonrpc": "2.0",
  "id": 25,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "json_fields": [
        { "path": "user.email", "alias": "user_email" },
        { "path": "request.ip", "alias": "ip_address" }
      ],
      "filters": {
        "raw_contains": "login",
        "level": "ERROR",
        "time_range": {
          "last": "24h"
        }
      },
      "sources": ["1386515"],
      "limit": 20
    }
  }
}
```

**Expected**: Should return login-related ERROR logs with user email and IP
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 8.2: Monitor API performance

```json
{
  "jsonrpc": "2.0",
  "id": 25,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "json_fields": [
        { "path": "request.method", "alias": "method" },
        { "path": "request.duration", "alias": "duration_ms" },
        { "path": "response.status", "alias": "status" }
      ],
      "filters": {
        "raw_contains": "API",
        "time_range": {
          "last": "2h"
        }
      },
      "sources": ["1386515"],
      "limit": 50
    }
  }
}
```

**Expected**: Should return API logs with method, duration, and status extracted
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 8.3: Find specific user activity

```json
{
  "jsonrpc": "2.0",
  "id": 26,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "json_fields": [
        { "path": "action", "alias": "user_action" },
        { "path": "resource", "alias": "resource_accessed" }
      ],
      "filters": {
        "json_field": {
          "path": "user.id",
          "value": "user_12345"
        },
        "time_range": {
          "start": "1 day ago"
        }
      },
      "sources": ["1386515"],
      "limit": 30
    }
  }
}
```

**Expected**: Should return user activity for specific user ID with action and resource details
**Result**: ✅ / ❌
**Notes**:

---

## 9. Output Format Testing

### [ ] Test 9.1: Default JSONEachRow format

```json
{
  "jsonrpc": "2.0",
  "id": 27,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "sources": ["1386515"],
      "limit": 5
    }
  }
}
```

**Expected**: Should return data in JSONEachRow format (array of objects)
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 9.2: Pretty format for human reading

```json
{
  "jsonrpc": "2.0",
  "id": 28,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "sources": ["1386515"],
      "limit": 5,
      "format": "Pretty"
    }
  }
}
```

**Expected**: Should return human-readable table format
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 9.3: CSV format for data export

```json
{
  "jsonrpc": "2.0",
  "id": 29,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "sources": ["1386515"],
      "limit": 5,
      "format": "CSV"
    }
  }
}
```

**Expected**: Should return comma-separated values
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 9.4: JSON format (single object)

```json
{
  "jsonrpc": "2.0",
  "id": 30,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "sources": ["1386515"],
      "limit": 5,
      "format": "JSON"
    }
  }
}
```

**Expected**: Should return single JSON object with array of results
**Result**: ✅ / ❌
**Notes**:

### [ ] Test 9.5: TSV format for spreadsheet import

```json
{
  "jsonrpc": "2.0",
  "id": 31,
  "method": "tools/call",
  "params": {
    "name": "query_logs",
    "arguments": {
      "sources": ["1386515"],
      "limit": 5,
      "format": "TSV"
    }
  }
}
```

**Expected**: Should return tab-separated values
**Result**: ✅ / ❌
**Notes**:

---

## Testing Notes

### Important Things to Verify:

- [ ] JSON objects are properly formatted (not showing `[object Object]`)
- [ ] Field validation is working correctly
- [ ] Time range filtering produces logical results
- [ ] JSON field extraction works for nested paths
- [ ] Combined filters work together as expected
- [ ] Error messages are clear and helpful
- [ ] Response times are reasonable
- [ ] Limit parameter is respected

### Common Issues to Watch For:

- Field validation errors
- Time parsing issues
- JSON path extraction failures
- Invalid filter combinations
- Network timeouts
- Authentication issues

### Overall Test Status:

**Tests Completed**: ** / 29  
**Tests Passed**: ** / 29  
**Tests Failed**: \_\_ / 29

**Start Time**: **\*\***\_\_\_\_**\*\***  
**End Time**: **\*\***\_\_\_\_**\*\***  
**Total Testing Duration**: **\*\***\_\_\_\_**\*\***
