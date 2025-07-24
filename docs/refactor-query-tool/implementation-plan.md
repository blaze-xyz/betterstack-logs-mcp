# Query Tool Refactor Implementation Plan

## Problem Statement

The current `query_logs` tool requires AI clients to write raw ClickHouse SQL, which creates several UX problems:

1. **Unknown Table Structure**: AI doesn't know BetterStack's internal table names (e.g., `spark_production_4`)
2. **Unknown Schema**: AI doesn't know available fields (`dt`, `raw`, `level`, `json`, etc.)  
3. **Syntax Guessing**: AI must guess ClickHouse-specific syntax and field names
4. **Trial and Error**: AI must iterate multiple times to construct working queries

**Evidence**: Debug logs show Claude trying invalid queries like:
- `SELECT * FROM recent ORDER BY timestamp DESC` ❌
- `SELECT * FROM logs ORDER BY _timestamp DESC` ❌

## Solution: Structured Query Builder

Replace raw SQL interface with a structured parameter-based approach where:
- **AI specifies business logic** (what fields, what filters, how to sort)
- **MCP server handles technical details** (table resolution, SQL generation, BetterStack syntax)

## New Tool Interface Design

### Tool Name: `query_logs_structured`

```typescript
{
  // FIELDS - What to select
  fields: z.array(z.enum([
    'dt',           // Timestamp
    'raw',          // Log message
    'level',        // Log level (INFO, ERROR, etc.)
    'json',         // Structured log data
    'source'        // Source name
  ])).default(['dt', 'raw']),

  // FILTERING - What to filter by
  filters: z.object({
    level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).optional(),
    message_contains: z.string().optional(),
    message_regex: z.string().optional(),
    time_range: z.object({
      start: z.string().optional(),  // ISO date or relative (e.g., "1 hour ago")
      end: z.string().optional(),
      last: z.string().optional()    // e.g., "1h", "30m", "2d"
    }).optional(),
    json_field: z.object({
      path: z.string(),              // e.g., "user.id", "request.method" 
      value: z.string()
    }).optional()
  }).optional(),

  // SORTING - How to order results
  order_by: z.enum(['dt', 'level']).default('dt'),
  order_direction: z.enum(['ASC', 'DESC']).default('DESC'),

  // LIMITS - Result size control
  limit: z.number().min(1).max(1000).default(10),

  // SOURCES - Same as current tool
  sources: z.array(z.string()).optional(),
  source_group: z.string().optional(),
  data_type: z.enum(['recent', 'historical', 'metrics']).optional()
}
```

## Implementation Strategy

### Phase 1: Core Infrastructure
1. **Create new structured tool** alongside existing `query_logs`
2. **Build query compiler** that translates structured params to ClickHouse SQL
3. **Implement field validation** and error handling
4. **Add comprehensive tests** for query generation

### Phase 2: Enhanced Features  
1. **Add JSON field querying** for structured log analysis
2. **Implement smart time parsing** (relative dates, natural language)
3. **Add query optimization** (automatic LIMIT enforcement, index hints)
4. **Create query explain functionality** for debugging

### Phase 3: Migration & Polish
1. **Add backward compatibility** warning for raw SQL tool
2. **Update documentation** and examples
3. **Deprecate old tool** with migration guidance
4. **Performance optimization** and caching

## Example Usage Transformations

### Before (Raw SQL - Error Prone)
```
Query: "SELECT * FROM recent ORDER BY timestamp DESC LIMIT 10"
❌ Wrong table name, wrong field name
```

### After (Structured - Reliable)
```javascript
{
  fields: ['dt', 'raw', 'level'],
  order_by: 'dt',
  order_direction: 'DESC', 
  limit: 10,
  sources: ['Spark - Production']
}
✅ Server generates: SELECT dt, raw, level FROM remote(spark_production_4) ORDER BY dt DESC LIMIT 10
```

## Query Compiler Implementation

### Core Components

1. **Field Mapper**: Maps business field names to actual ClickHouse columns
2. **Filter Builder**: Converts structured filters to WHERE clauses
3. **Table Resolver**: Uses existing source resolution logic
4. **SQL Generator**: Assembles final ClickHouse query with proper syntax

### Query Building Pipeline

```
Structured Params → Validate → Resolve Sources → Build Filters → Generate SQL → Execute
```

## Error Handling Strategy

1. **Validation Errors**: Clear messages about invalid field names or filter values
2. **Source Resolution Errors**: Helpful suggestions for source names/groups
3. **Query Execution Errors**: BetterStack-specific error translation
4. **Fallback Mechanism**: Option to see generated SQL for debugging

## Testing Strategy

1. **Unit Tests**: Query generation for all parameter combinations
2. **Integration Tests**: End-to-end query execution with mock data
3. **Regression Tests**: Ensure existing query patterns still work
4. **Performance Tests**: Query optimization and response times

## Documentation Requirements

1. **Tool Schema Documentation**: Clear parameter descriptions and examples
2. **Field Reference**: Complete list of available fields and their meanings
3. **Filter Examples**: Common filtering patterns and use cases
4. **Migration Guide**: How to convert raw SQL queries to structured format

## Success Metrics

1. **Query Success Rate**: % of queries that work on first try
2. **Error Reduction**: Decrease in 404/syntax errors from query tool
3. **Usage Adoption**: Migration from raw SQL to structured tool
4. **AI Satisfaction**: Reduced back-and-forth iterations in Claude Desktop

## Risk Mitigation

1. **Backward Compatibility**: Keep old tool during transition period
2. **Feature Parity**: Ensure structured tool can handle all current use cases
3. **Performance**: Structured approach should be as fast as raw SQL
4. **Flexibility**: Advanced users can still access raw SQL if needed

## Timeline Estimate

- **Phase 1 (Core)**: 2-3 days
- **Phase 2 (Enhanced)**: 2-3 days  
- **Phase 3 (Migration)**: 1-2 days
- **Total**: ~1 week for complete implementation

## Next Steps

1. Implement query compiler and structured tool interface
2. Create comprehensive test suite
3. Build example queries and documentation
4. Test with real Claude Desktop usage
5. Gather feedback and iterate