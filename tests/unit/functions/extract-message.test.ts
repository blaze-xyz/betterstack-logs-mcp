import { extractMessage } from '../../../src/tools/query-tools.js';

describe('extractMessage', () => {
  it('should extract message field from valid JSON', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"User login successful","user_id":12345}';
    const result = extractMessage(rawLog);
    expect(result).toBe('User login successful');
  });

  it('should extract msg field when message field is not present', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","msg":"Database connected","service":"auth"}';
    const result = extractMessage(rawLog);
    expect(result).toBe('Database connected');
  });

  it('should return raw string when neither message nor msg fields are present', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","service":"auth"}';
    const result = extractMessage(rawLog);
    expect(result).toBe(rawLog);
  });

  it('should return raw string when JSON parsing fails', () => {
    const rawLog = 'Invalid JSON string with no structure';
    const result = extractMessage(rawLog);
    expect(result).toBe(rawLog);
  });

  it('should handle empty message fields gracefully', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"","msg":"Fallback message"}';
    const result = extractMessage(rawLog);
    expect(result).toBe('Fallback message');
  });

  it('should handle null message fields gracefully', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":null,"msg":"Fallback message"}';
    const result = extractMessage(rawLog);
    expect(result).toBe('Fallback message');
  });

  it('should handle empty raw input', () => {
    const rawLog = '';
    const result = extractMessage(rawLog);
    expect(result).toBe('');
  });

  it('should prefer message over msg when both are present', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":"Primary message","msg":"Secondary message"}';
    const result = extractMessage(rawLog);
    expect(result).toBe('Primary message');
  });

  it('should handle complex nested JSON structures', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"ERROR","message":"API request failed","error":{"code":500,"details":{"timeout":true}}}';
    const result = extractMessage(rawLog);
    expect(result).toBe('API request failed');
  });

  it('should handle non-string message values', () => {
    const rawLog = '{"timestamp":"2024-01-01T10:00:00Z","level":"INFO","message":12345}';
    const result = extractMessage(rawLog);
    expect(result).toBe(12345);
  });
});