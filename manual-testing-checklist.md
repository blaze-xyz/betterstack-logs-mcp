# BetterStack Logs MCP - Manual Testing Checklist

This checklist covers comprehensive testing of all MCP tools available in the BetterStack Logs server. Tests can now be executed automatically using the semi-automated test harness.

**Updated**: 2025-07-31 - Completely rewritten to reflect current MCP server functionality.

## 🚀 Quick Start

### Run All Tests Automatically
```bash
npm run test:manual
```

### Run Specific Category
```bash
npm run test:manual -- --category source-management
npm run test:manual -- --category log-querying
```

### Run Specific Test
```bash
npm run test:manual -- --test 1.1
npm run test:manual -- --test source-management.list-sources
```

### List Available Tests
```bash
npm run test:manual -- --list
```

For detailed results and logs, check the `dist/logs/manual-tests/` directory after execution.

## Test Progress Tracker

- [x] **Source Management Tests** (5 tests) - `source-management`
- [x] **Log Querying Tests** (6 tests) - `log-querying`
- [x] **Output Format Tests** (5 tests) - `output-formats`
- [x] **Debug Tools Tests** (1 test) - `debug-tools`
- [x] **Limit Testing** (2 tests) - `limit-testing`

**Total**: 19 tests across 5 categories

---

## 1. Source Management Tests

### [x] Test 1.1: List all available log sources
**Test Case Reference**: `source-management.list-sources`  
**Tool**: `list_sources`  
**Expected**: Should return list of configured sources with IDs and platform info  
**Result**: ✅ (Automated)  
**Notes**: Verifies basic source discovery functionality

### [x] Test 1.2: List all source groups
**Test Case Reference**: `source-management.list-source-groups`  
**Tool**: `list_source_groups`  
**Expected**: Should return source groups (may be empty if no groups configured)  
**Result**: ✅ (Automated)  
**Notes**: May require team API token instead of personal token

### [x] Test 1.3: Get detailed information about a specific source
**Test Case Reference**: `source-management.get-source-info`  
**Tool**: `get_source_info`  
**Expected**: Should return detailed source information including platform and retention  
**Result**: ✅ (Automated)  
**Notes**: Tests source resolution by ID

### [x] Test 1.4: Get detailed information about a source group
**Test Case Reference**: `source-management.get-source-group-info`  
**Tool**: `get_source_group_info`  
**Expected**: Should return source group details and included sources  
**Result**: ✅ (Automated)  
**Notes**: Tests source group resolution by name

### [x] Test 1.5: Test connection to BetterStack APIs
**Test Case Reference**: `source-management.test-connection`  
**Tool**: `test_connection`  
**Expected**: Should verify connectivity to both Telemetry API and ClickHouse  
**Result**: ✅ (Automated)  
**Notes**: Essential for verifying API credentials and network connectivity

---

## 2. Log Querying Tests

### [x] Test 2.1: Basic log query without filters
**Test Case Reference**: `log-querying.basic-query`  
**Tool**: `query_logs`  
**Expected**: Should return recent logs with timestamp (dt) and raw message fields  
**Result**: ✅ (Automated)  
**Notes**: Tests basic query functionality with minimal parameters

### [x] Test 2.2: Search logs by raw content substring
**Test Case Reference**: `log-querying.raw-content-search`  
**Tool**: `query_logs`  
**Expected**: Should return logs containing specified substring (case-insensitive)  
**Result**: ✅ (Automated)  
**Notes**: Tests `raw_contains` filter functionality

### [x] Test 2.3: Filter logs by level
**Test Case Reference**: `log-querying.level-filtering`  
**Tool**: `query_logs`  
**Expected**: Should return logs with specified level using pattern matching  
**Result**: ✅ (Automated)  
**Notes**: Tests `level` filter with ERROR level pattern

### [x] Test 2.4: Filter logs by relative time range
**Test Case Reference**: `log-querying.time-filtering-relative`  
**Tool**: `query_logs`  
**Expected**: Should return logs from specified relative time range (last_30_minutes)  
**Result**: ✅ (Automated)  
**Notes**: Tests relative time filtering options

### [x] Test 2.5: Filter logs by custom time range
**Test Case Reference**: `log-querying.time-filtering-custom`  
**Tool**: `query_logs`  
**Expected**: Should return logs within specified custom datetime range  
**Result**: ✅ (Automated)  
**Notes**: Tests custom time range with ISO timestamps

### [x] Test 2.6: Combine multiple filters
**Test Case Reference**: `log-querying.combined-filters`  
**Tool**: `query_logs`  
**Expected**: Should return logs matching all specified filters (content + level + time)  
**Result**: ✅ (Automated)  
**Notes**: Tests complex filter combinations

---

## 3. Output Format Tests

### [x] Test 3.1: Default JSONEachRow format
**Test Case Reference**: `output-formats.default-jsonrows`  
**Tool**: `query_logs`  
**Expected**: Should return data in JSONEachRow format (default)  
**Result**: ✅ (Automated)  
**Notes**: Tests default output format

### [x] Test 3.2: Pretty format for human reading
**Test Case Reference**: `output-formats.pretty-format`  
**Tool**: `query_logs`  
**Expected**: Should return human-readable table format  
**Result**: ❌ (Automated)  
**Notes**: Tests Pretty format output

### [x] Test 3.3: CSV format for data export
**Test Case Reference**: `output-formats.csv-format`  
**Tool**: `query_logs`  
**Expected**: Should return comma-separated values  
**Result**: ❌ (Automated)  
**Notes**: Tests CSV format for data export

### [x] Test 3.4: JSON format (single object)
**Test Case Reference**: `output-formats.json-format`  
**Tool**: `query_logs`  
**Expected**: Should return single JSON object with array of results  
**Result**: ❌ (Automated)  
**Notes**: Tests JSON format output

### [x] Test 3.5: TSV format for spreadsheet import
**Test Case Reference**: `output-formats.tsv-format`  
**Tool**: `query_logs`  
**Expected**: Should return tab-separated values  
**Result**: ❌ (Automated)  
**Notes**: Tests TSV format for spreadsheet compatibility

---

## 4. Debug Tools Tests

### [x] Test 4.1: Debug table information and schema
**Test Case Reference**: `debug-tools.debug-table-info`  
**Tool**: `debug_table_info`  
**Expected**: Should show table schema and query generation info  
**Result**: ✅ (Automated)  
**Notes**: Tests debugging functionality for table schema inspection

---

## 5. Limit Testing

### [x] Test 5.1: Small limit test
**Test Case Reference**: `limit-testing.small-limit`  
**Tool**: `query_logs`  
**Expected**: Should return exactly 1 log entry  
**Result**: ✅ (Automated)  
**Notes**: Tests limit parameter with small value

### [x] Test 5.2: Large limit test
**Test Case Reference**: `limit-testing.large-limit`  
**Tool**: `query_logs`  
**Expected**: Should return up to 100 log entries  
**Result**: ✅ (Automated)  
**Notes**: Tests limit parameter with larger value

---

## Testing Notes

### Available MCP Tools (2025-07-31):

#### Source Management Tools:
- `list_sources` - List all available log sources
- `list_source_groups` - List all source groups
- `get_source_info` - Get detailed source information
- `get_source_group_info` - Get detailed source group information  
- `test_connection` - Test API connectivity

#### Log Querying Tools:
- `query_logs` - Main log querying tool with filters and formatting
- `debug_table_info` - Debug table schema and query generation

### Key Changes from Previous Version:
- **Removed**: JSON field extraction functionality (no longer supported)
- **Updated**: Time filtering now uses `time_filter` with `relative` or `custom` options
- **Updated**: Level filtering uses pattern matching instead of exact field matching
- **Added**: Source management tools for discovery and connection testing
- **Added**: Debug tools for troubleshooting table schemas

### Important Things to Verify:

- [ ] Source discovery works correctly with available sources
- [ ] Connection testing validates both APIs (Telemetry + ClickHouse)
- [ ] Log querying returns proper dt (timestamp) and raw (message) fields
- [ ] Time range filtering produces logical results with proper SQL generation
- [ ] Level filtering uses pattern matching correctly
- [ ] Combined filters work together as expected
- [ ] Output format variations work (JSONEachRow, Pretty, CSV, JSON, TSV)
- [ ] Error messages are clear and helpful
- [ ] Response times are reasonable
- [ ] Limit parameter is respected

### Common Issues to Watch For:

- Source not found errors (check source ID/name)
- Connection failures (check API tokens and network)
- Time parsing issues with custom ranges
- Level filtering not finding matches (check pattern format)
- Invalid filter combinations
- Network timeouts with large queries
- Authentication issues (personal vs team tokens)
- Table schema issues (use debug_table_info to investigate)

### Overall Test Status:

**Tests Completed**: 19 / 19  
**Tests Passed**: ~13-15 / 19 (varies by environment)  
**Tests Failed**: ~4-6 / 19 (primarily output format tests)

**Common Failures**: Output format tests (Pretty, CSV, JSON, TSV) may fail due to ClickHouse format handling

---

## 🤖 Automated Test Harness

### Overview
This checklist is supported by a semi-automated test harness that executes all test cases programmatically while generating detailed logs for human review.

### Key Benefits
- **Time Savings**: Reduces manual testing from ~45 minutes to ~2 minutes + review time
- **Consistency**: Same test conditions every time, eliminating environment variability  
- **Thoroughness**: Ensures all test cases are executed, not just the easy ones
- **Documentation**: Creates audit trail of test execution and results
- **Regression Testing**: Easy to re-run tests after code changes

### Test Case Structure
All test cases are defined in `tests/manual/test-cases.ts` with:
- **Structured payloads**: TypeScript-validated test parameters
- **Expected results**: Automated validation criteria
- **Mock data**: Consistent, predictable test responses
- **Categorization**: Organized by functionality for targeted testing

### Running Tests

#### All Tests
```bash
npm run test:manual
```

#### By Category
```bash
# Source Management Tests
npm run test:manual -- --category source-management

# Log Querying Tests  
npm run test:manual -- --category log-querying

# Output Format Tests
npm run test:manual -- --category output-formats

# Debug Tools Tests
npm run test:manual -- --category debug-tools

# Limit Testing
npm run test:manual -- --category limit-testing
```

#### Specific Tests
```bash
# By test ID
npm run test:manual -- --test 1.1

# By category.test format
npm run test:manual -- --test source-management.list-sources
npm run test:manual -- --test log-querying.basic-query
```

#### With Detailed Logging
```bash
npm run test:manual -- --verbose
```

### Output Files
After execution, results are saved to `dist/logs/manual-tests/`:
- **`YYYY-MM-DDTHH-MM-SS_detailed.log`**: Complete execution log with validation results
- **`YYYY-MM-DDTHH-MM-SS_summary.json`**: Machine-readable test results for CI/CD integration  
- **`YYYY-MM-DDTHH-MM-SS_review.md`**: Human review checklist highlighting issues that need attention
- **`YYYY-MM-DDTHH-MM-SS_junit.xml`**: JUnit format for test reporting tools

### Manual Review Process
1. **Run automated tests**: `npm run test:manual`
2. **Check success rate**: Review console output for overall pass/fail status
3. **Review failed tests**: Open `*_review.md` for tests requiring attention
4. **Validate results**: For passed tests, spot-check a few results in `*_detailed.log`
5. **Investigate issues**: Use detailed logs to debug any failed tests

### When to Use Manual Testing
The automated harness covers functional validation, but manual testing may still be needed for:
- **User experience**: Evaluating result presentation and readability
- **Edge cases**: Complex scenarios not covered by automated tests  
- **Performance**: Response times under different load conditions
- **Integration**: End-to-end testing with real BetterStack data
- **New features**: Testing functionality not yet automated

### Test Case References
Each test case maps to a structured test case:

| Test ID | Test Case Reference | Category | Tool |
|---------|--------------------|-----------| -----|
| 1.1 | `source-management.list-sources` | Source Management | `list_sources` |
| 1.2 | `source-management.list-source-groups` | Source Management | `list_source_groups` |
| 1.3 | `source-management.get-source-info` | Source Management | `get_source_info` |
| 1.4 | `source-management.get-source-group-info` | Source Management | `get_source_group_info` |
| 1.5 | `source-management.test-connection` | Source Management | `test_connection` |
| 2.1 | `log-querying.basic-query` | Log Querying | `query_logs` |
| 2.2 | `log-querying.raw-content-search` | Log Querying | `query_logs` |
| 2.3 | `log-querying.level-filtering` | Log Querying | `query_logs` |
| 2.4 | `log-querying.time-filtering-relative` | Log Querying | `query_logs` |
| 2.5 | `log-querying.time-filtering-custom` | Log Querying | `query_logs` |
| 2.6 | `log-querying.combined-filters` | Log Querying | `query_logs` |
| 3.1 | `output-formats.default-jsonrows` | Output Formats | `query_logs` |
| 3.2 | `output-formats.pretty-format` | Output Formats | `query_logs` |
| 3.3 | `output-formats.csv-format` | Output Formats | `query_logs` |
| 3.4 | `output-formats.json-format` | Output Formats | `query_logs` |
| 3.5 | `output-formats.tsv-format` | Output Formats | `query_logs` |
| 4.1 | `debug-tools.debug-table-info` | Debug Tools | `debug_table_info` |
| 5.1 | `limit-testing.small-limit` | Limit Testing | `query_logs` |
| 5.2 | `limit-testing.large-limit` | Limit Testing | `query_logs` |