export interface Source {
  id: string;
  name: string;
  platform?: string;
  retention_days?: number;
  created_at?: string;
  updated_at?: string;
}

// JSON:API format from Betterstack Telemetry API
export interface BetterstackApiSource {
  id: string;
  type: string;
  attributes: {
    team_id: number;
    team_name: string;
    name: string;
    source_group_id?: number;
    table_name: string;
    platform: string;
    token: string;
    ingesting_host: string;
    ingesting_paused: boolean;
    logs_retention: number;
    metrics_retention: number;
    live_tail_pattern?: string;
    vrl_transformation?: string;
    created_at: string;
    updated_at: string;
  };
}

export interface SourceGroup {
  id: string;
  name: string;
  source_ids: string[];
  created_at?: string;
  updated_at?: string;
  sort_index?: number;
  team_name?: string;
}

export interface BetterstackApiSourceGroup {
  id: string;
  type: "source_group";
  attributes: {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
    sort_index: number;
    team_name: string;
  };
}

export interface SourceGroupInfo extends SourceGroup {
  sources: Source[];
  total_sources: number;
  aggregate_retention_days?: number;
}

export interface LogEntry {
  dt: string;
  raw: string;
  source?: string;
  [key: string]: any;
}

export interface MetricEntry {
  dt: string;
  metric_name: string;
  value: number;
  source?: string;
  [key: string]: any;
}

export interface QueryResult {
  data: LogEntry[] | MetricEntry[];
  meta?: {
    total_rows?: number;
    query_time_ms?: number;
    sources_queried: string[];
    api_used?: string;
    executed_sql?: string;
  };
}

export interface BetterstackApiError {
  code: string;
  message: string;
  details?: any;
}

export type DataSourceType = 'recent' | 'historical' | 'metrics' | 'union';

// Time filter options matching BetterStack UI exactly
export type RelativeTimeFilter = 
  | 'last_30_minutes'
  | 'last_60_minutes'
  | 'last_3_hours'
  | 'last_6_hours'
  | 'last_12_hours'
  | 'last_24_hours'
  | 'last_2_days'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'everything';

export interface CustomTimeRange {
  start_datetime: string; // ISO datetime string
  end_datetime: string;   // ISO datetime string
}

export interface TimeFilter {
  relative?: RelativeTimeFilter;
  custom?: CustomTimeRange;
}

export interface QueryOptions {
  sources?: string[];
  sourceGroup?: string;
  dataType?: DataSourceType;
  limit?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
  // Raw filters for s3 optimization
  rawFilters?: {
    time_filter?: TimeFilter;
  };
}

export interface TableColumn {
  name: string;
  type: string;
  default_type?: string;
  default_expression?: string;
  comment?: string;
  codec_expression?: string;
  ttl_expression?: string;
}

export interface TableSchema {
  tableName: string;
  columns: TableColumn[];
  availableFields: string[];
  cacheTimestamp: number;
}