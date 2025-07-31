import { describe, it, expect } from 'vitest';
import path from 'path';
import { getProjectRoot, getLogFilePath } from '../../src/utils/logging.js';

describe('Logging Utility', () => {
  // Mock project structure - completely isolated from actual filesystem
  const mockProjectRoot = '/mock/project';

  describe('getProjectRoot', () => {
    it('should calculate correct project root from compiled src location', () => {
      const mockCompiledUrl = `file://${path.join(mockProjectRoot, 'dist/src/index.js')}`;
      const calculatedRoot = getProjectRoot(mockCompiledUrl);
      
      expect(path.resolve(calculatedRoot)).toBe(mockProjectRoot);
    });

    it('should calculate correct project root from compiled tools location', () => {
      const mockCompiledToolsUrl = `file://${path.join(mockProjectRoot, 'dist/src/tools/query-tools.js')}`;
      const calculatedRoot = getProjectRoot(mockCompiledToolsUrl);
      
      expect(path.resolve(calculatedRoot)).toBe(mockProjectRoot);
    });

    it('should calculate correct project root from compiled utils location', () => {
      const mockCompiledUtilsUrl = `file://${path.join(mockProjectRoot, 'dist/src/utils/logging.js')}`;
      const calculatedRoot = getProjectRoot(mockCompiledUtilsUrl);
      
      expect(path.resolve(calculatedRoot)).toBe(mockProjectRoot);
    });

    it('should calculate correct project root from source src location', () => {
      const mockSourceUrl = `file://${path.join(mockProjectRoot, 'src/index.ts')}`;
      const calculatedRoot = getProjectRoot(mockSourceUrl);
      
      expect(path.resolve(calculatedRoot)).toBe(mockProjectRoot);
    });

    it('should calculate correct project root from source tools location', () => {
      const mockSourceToolsUrl = `file://${path.join(mockProjectRoot, 'src/tools/query-tools.ts')}`;
      const calculatedRoot = getProjectRoot(mockSourceToolsUrl);
      
      expect(path.resolve(calculatedRoot)).toBe(mockProjectRoot);
    });

    it('should calculate correct project root from source utils location', () => {
      const mockSourceUtilsUrl = `file://${path.join(mockProjectRoot, 'src/utils/logging.ts')}`;
      const calculatedRoot = getProjectRoot(mockSourceUtilsUrl);
      
      expect(path.resolve(calculatedRoot)).toBe(mockProjectRoot);
    });

    it('should throw error when neither dist nor src found in path', () => {
      const mockBadUrl = `file://${path.join(mockProjectRoot, 'some/other/path/file.js')}`;
      
      expect(() => getProjectRoot(mockBadUrl)).toThrow('Expected to find "src" in path when running from source code');
    });
  });

  describe('getLogFilePath', () => {
    it('should return correct log file path from any location', () => {
      const mockUrl = `file://${path.join(mockProjectRoot, 'src/index.ts')}`;
      const logPath = getLogFilePath(mockUrl);
      const expectedPath = path.join(mockProjectRoot, 'mcp-debug.log');
      
      expect(logPath).toBe(expectedPath);
    });

    it('should return same log file path from compiled and source locations', () => {
      const sourceUrl = `file://${path.join(mockProjectRoot, 'src/index.ts')}`;
      const compiledUrl = `file://${path.join(mockProjectRoot, 'dist/src/index.js')}`;
      
      const sourceLogPath = getLogFilePath(sourceUrl);
      const compiledLogPath = getLogFilePath(compiledUrl);
      
      expect(sourceLogPath).toBe(compiledLogPath);
      expect(sourceLogPath).toBe(path.join(mockProjectRoot, 'mcp-debug.log'));
    });
  });
});