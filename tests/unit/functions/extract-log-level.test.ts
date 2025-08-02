import { extractLogLevel } from '../../../src/tools/query-tools.js';

describe('extractLogLevel', () => {
  it('should extract level field from valid JSON', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"User login successful","user_id":12345}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('INFO');
  });

  it('should extract severity field when level field is not present', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","severity":"error","message":"Database connection failed","service":"auth"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('ERROR');
  });

  it('should extract loglevel field when level and severity fields are not present', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","loglevel":"warn","message":"High memory usage detected","service":"monitoring"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('WARN');
  });

  it('should return null when no level fields are present', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","message":"System startup complete","service":"core"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBeNull();
  });

  it('should return null when JSON parsing fails', () => {
    const rawLog = 'Invalid JSON string with no structure';
    const result = extractLogLevel(rawLog);
    expect(result).toBeNull();
  });

  it('should normalize lowercase levels to uppercase', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"debug","message":"Processing request","trace_id":"abc123"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('DEBUG');
  });

  it('should normalize mixed case levels to uppercase', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"Warning","message":"Deprecated API usage","api_version":"v1"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('WARNING');
  });

  it('should handle numeric level values by converting to string', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":3,"message":"Informational message","system":"logging"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('3');
  });

  it('should handle empty string level values by returning null', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"","message":"Empty level test","service":"test"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBeNull();
  });

  it('should handle null level values by returning null', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":null,"message":"Null level test","service":"test"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBeNull();
  });

  it('should prefer level over severity when both are present', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"ERROR","severity":"warn","message":"Conflicting levels test"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('ERROR');
  });

  it('should prefer severity over loglevel when level is not present', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","severity":"FATAL","loglevel":"error","message":"Severity priority test"}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('FATAL');
  });

  it('should handle complex nested JSON structures', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"CRITICAL","message":"System failure","error":{"code":500,"details":{"timeout":true,"retries":3}}}';
    const result = extractLogLevel(rawLog);
    expect(result).toBe('CRITICAL');
  });

  it('should handle empty raw input', () => {
    const rawLog = '';
    const result = extractLogLevel(rawLog);
    expect(result).toBeNull();
  });

  it('should handle common log level variations', () => {
    const testCases = [
      { input: '{"level":"info"}', expected: 'INFO' },
      { input: '{"level":"WARN"}', expected: 'WARN' },
      { input: '{"level":"Error"}', expected: 'ERROR' },
      { input: '{"level":"TRACE"}', expected: 'TRACE' },
      { input: '{"level":"FATAL"}', expected: 'FATAL' },
      { input: '{"level":"debug"}', expected: 'DEBUG' }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractLogLevel(input);
      expect(result).toBe(expected);
    });
  });
});