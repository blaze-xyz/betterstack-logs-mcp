export interface Source {
  id: string;
  name: string;
  platform?: string;
  retention_days?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SourceGroup {
  id: string;
  name: string;
  source_ids: string[];
  created_at?: string;
  updated_at?: string;
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
  };
}

export interface BetterstackApiError {
  code: string;
  message: string;
  details?: any;
}

export type DataSourceType = 'recent' | 'historical' | 'metrics';

export interface QueryOptions {
  sources?: string[];
  sourceGroup?: string;
  dataType?: DataSourceType;
  limit?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
}