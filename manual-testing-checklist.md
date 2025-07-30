# BetterStack Logs MCP - Manual Testing Checklist

This checklist covers comprehensive testing of the `query_logs` tool. Tests can now be executed automatically using the semi-automated test harness.

## 🚀 Quick Start

### Run All Tests Automatically
```bash
npm run test:manual
```

### Run Specific Category
```bash
npm run test:manual -- --category json-field-extraction
```

### Run Specific Test
```bash
npm run test:manual -- --test 1.1
```

### List Available Tests
```bash
npm run test:manual:list
```

For detailed results and logs, check the `logs/manual-tests/` directory after execution.

## Test Progress Tracker

- [x] **JSON Field Extraction Tests** (3 tests) - `json-field-extraction`
- [x] **Raw Content Filtering Tests** (2 tests) - `raw-content-filtering`
- [x] **Log Level Filtering Tests** (3 tests) - `log-level-filtering`  
- [x] **Time Range Filtering Tests** (5 tests) - `time-range-filtering`
- [x] **Combined Filter Tests** (2 tests) - `combined-filters`
- [x] **Limit Testing** (2 tests) - `limit-testing`
- [x] **Complex Real-World Scenarios** (2 tests) - `complex-scenarios`
- [x] **Output Format Testing** (5 tests) - `output-formats`

---

## 1. JSON Field Extraction Tests

### [x] Test 1.1: Extract JSON field with default alias
**Test Case Reference**: `json-field-extraction.extract-default-alias`  
**Expected**: Should extract level field from JSON with default alias  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 1.2: Extract JSON field with custom alias
**Test Case Reference**: `json-field-extraction.extract-custom-alias`  
**Expected**: Should extract level field with custom alias "log_level"  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 1.3: Extract multiple nested JSON fields
**Test Case Reference**: `json-field-extraction.extract-multiple-nested`  
**Expected**: Should extract multiple nested JSON fields with aliases  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

---

## 2. Raw Content Filtering Tests

### [x] Test 2.1: Simple substring search
**Test Case Reference**: `raw-content-filtering.simple-substring-search`  
**Expected**: Should return logs containing "error" in raw field  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 2.2: Search for specific patterns
**Test Case Reference**: `raw-content-filtering.specific-pattern-search`  
**Expected**: Should return logs containing "HTTP 500" pattern  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

---

## 3. Log Level Filtering Tests

### [x] Test 3.1: Filter by ERROR level
**Test Case Reference**: `log-level-filtering.filter-error-level`  
**Expected**: Should return only ERROR level logs  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 3.2: Filter by INFO level
**Test Case Reference**: `log-level-filtering.filter-info-level`  
**Expected**: Should return only INFO level logs  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 3.3: Filter by WARN level
**Test Case Reference**: `log-level-filtering.filter-warn-level`  
**Expected**: Should return only WARN level logs  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

---

## 4. Time Range Filtering Tests

### [x] Test 4.1: Last hour
**Test Case Reference**: `time-range-filtering.last-hour`  
**Expected**: Should return logs from last 1 hour  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 4.2: Last 30 minutes
**Test Case Reference**: `time-range-filtering.last-30-minutes`  
**Expected**: Should return logs from last 30 minutes  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 4.3: Specific time range with start and end
**Test Case Reference**: `time-range-filtering.specific-time-range`  
**Expected**: Should return logs between specified start and end times  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 4.4: Start and end with ISO timestamps
**Test Case Reference**: `time-range-filtering.iso-timestamps`  
**Expected**: Should return logs between ISO timestamps 2024-07-28T10:00:00Z and 2024-07-28T12:00:00Z  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 4.5: Relative start time
**Test Case Reference**: `time-range-filtering.relative-start-time`  
**Expected**: Should return logs from 2 hours ago onwards  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

---

## 5. Combined Filter Tests

### [x] Test 5.1: Multiple filters combined
**Test Case Reference**: `combined-filters.multiple-filters`  
**Expected**: Should return ERROR level logs containing "error" from last hour  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 5.2: Level + time range + JSON extraction
**Test Case Reference**: `combined-filters.level-time-json`  
**Expected**: Should return INFO logs from last 30m with extracted user and duration fields  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

---

## 6. Limit Testing

### [x] Test 6.1: Small limit
**Test Case Reference**: `limit-testing.small-limit`  
**Expected**: Should return exactly 1 log entry  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 6.2: Large limit
**Test Case Reference**: `limit-testing.large-limit`  
**Expected**: Should return up to 100 log entries  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

---

## 7. Complex Real-World Scenarios

### [x] Test 7.1: Debug login issues
**Test Case Reference**: `complex-scenarios.debug-login-issues`  
**Expected**: Should return login-related ERROR logs with user email and IP  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 7.2: Monitor API performance
**Test Case Reference**: `complex-scenarios.monitor-api-performance`  
**Expected**: Should return API logs with method, duration, and status extracted  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

---

## 8. Output Format Testing

### [x] Test 8.1: Default JSONEachRow format
**Test Case Reference**: `output-formats.default-jsonrows`  
**Expected**: Should return data in JSONEachRow format (array of objects)  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 8.2: Pretty format for human reading
**Test Case Reference**: `output-formats.pretty-format`  
**Expected**: Should return human-readable table format  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 8.3: CSV format for data export
**Test Case Reference**: `output-formats.csv-format`  
**Expected**: Should return comma-separated values  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 8.4: JSON format (single object)
**Test Case Reference**: `output-formats.json-format`  
**Expected**: Should return single JSON object with array of results  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

### [x] Test 8.5: TSV format for spreadsheet import
**Test Case Reference**: `output-formats.tsv-format`  
**Expected**: Should return tab-separated values  
**Result**: ✅ (Automated)  
**Notes**: Use automated test harness

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

**Tests Completed**: ** / 24  
**Tests Passed**: ** / 24  
**Tests Failed**: \_\_ / 24

**Start Time**: **\*\***\_\_\_\_**\*\***  
**End Time**: **\*\***\_\_\_\_**\*\***  
**Total Testing Duration**: **\*\***\_\_\_\_**\*\***

---

## 🤖 Automated Test Harness

### Overview
This checklist is now supported by a semi-automated test harness that can execute all test cases programmatically while generating detailed logs for human review.

### Key Benefits
- **Time Savings**: Reduces manual testing from ~45 minutes to ~2 minutes + review time
- **Consistency**: Same test conditions every time, eliminating environment variability  
- **Thoroughness**: Ensures all test cases are executed, not just the easy ones
- **Documentation**: Creates audit trail of test execution and results
- **Regression Testing**: Easy to re-run tests after code changes

### Test Case Structure
All test cases are now defined in `tests/manual/test-cases.ts` with:
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
# JSON Field Extraction Tests
npm run test:manual -- --category json-field-extraction

# Time Range Filtering Tests  
npm run test:manual -- --category time-range-filtering

# Output Format Testing
npm run test:manual -- --category output-formats
```

#### Specific Tests
```bash
# By test ID
npm run test:manual -- --test 1.1

# By category.test format
npm run test:manual -- --test json-field-extraction.extract-default-alias
```

#### With Detailed Logging
```bash
npm run test:manual:verbose
```

### Output Files
After execution, results are saved to `logs/manual-tests/`:
- **`detailed.log`**: Complete execution log with validation results
- **`summary.json`**: Machine-readable test results for CI/CD integration  
- **`review.md`**: Human review checklist highlighting issues that need attention
- **`junit.xml`**: JUnit format for test reporting tools

### Manual Review Process
1. **Run automated tests**: `npm run test:manual`
2. **Check success rate**: Review console output for overall pass/fail status
3. **Review failed tests**: Open `review.md` for tests requiring attention
4. **Validate results**: For passed tests, spot-check a few results in `detailed.log`
5. **Investigate issues**: Use detailed logs to debug any failed tests

### When to Use Manual Testing
The automated harness covers functional validation, but manual testing may still be needed for:
- **User experience**: Evaluating result presentation and readability
- **Edge cases**: Complex scenarios not covered by automated tests  
- **Performance**: Response times under different load conditions
- **Integration**: End-to-end testing with real BetterStack data
- **New features**: Testing functionality not yet automated

### Test Case References
Each original test case now maps to a structured test case:

| Original ID | Test Case Reference | Category |
|-------------|--------------------|-----------| 
| 1.1 | `json-field-extraction.extract-default-alias` | JSON Field Extraction |
| 1.2 | `json-field-extraction.extract-custom-alias` | JSON Field Extraction |
| 1.3 | `json-field-extraction.extract-multiple-nested` | JSON Field Extraction |
| 2.1 | `raw-content-filtering.simple-substring-search` | Raw Content Filtering |
| 2.2 | `raw-content-filtering.specific-pattern-search` | Raw Content Filtering |
| 3.1 | `log-level-filtering.filter-error-level` | Log Level Filtering |
| 3.2 | `log-level-filtering.filter-info-level` | Log Level Filtering |
| 3.3 | `log-level-filtering.filter-warn-level` | Log Level Filtering |
| 4.1 | `time-range-filtering.last-hour` | Time Range Filtering |
| 4.2 | `time-range-filtering.last-30-minutes` | Time Range Filtering |
| 4.3 | `time-range-filtering.specific-time-range` | Time Range Filtering |
| 4.4 | `time-range-filtering.iso-timestamps` | Time Range Filtering |
| 4.5 | `time-range-filtering.relative-start-time` | Time Range Filtering |
| 5.1 | `combined-filters.multiple-filters` | Combined Filter Tests |
| 5.2 | `combined-filters.level-time-json` | Combined Filter Tests |
| 6.1 | `limit-testing.small-limit` | Limit Testing |
| 6.2 | `limit-testing.large-limit` | Limit Testing |
| 7.1 | `complex-scenarios.debug-login-issues` | Complex Real-World Scenarios |
| 7.2 | `complex-scenarios.monitor-api-performance` | Complex Real-World Scenarios |
| 8.1 | `output-formats.default-jsonrows` | Output Format Testing |
| 8.2 | `output-formats.pretty-format` | Output Format Testing |
| 8.3 | `output-formats.csv-format` | Output Format Testing |
| 8.4 | `output-formats.json-format` | Output Format Testing |
| 8.5 | `output-formats.tsv-format` | Output Format Testing |
