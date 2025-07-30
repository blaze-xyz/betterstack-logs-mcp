import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Calculates the project root directory from any location within the project.
 * Works correctly from both source (src/) and compiled (dist/src/) locations.
 * 
 * @param currentFileUrl - The import.meta.url of the calling file
 * @returns Absolute path to the project root directory
 */
export function getProjectRoot(currentFileUrl: string): string {
  const __filename = fileURLToPath(currentFileUrl);
  const __dirname = path.dirname(__filename);
  
  // Navigate to project root based on current location
  if (__dirname.includes('dist')) {
    // Running from compiled code (dist/src/ or dist/src/tools/ or dist/src/utils/)
    // Find how many levels deep we are in the dist directory
    const pathParts = __dirname.split(path.sep);
    const distIndex = pathParts.findIndex(part => part === 'dist');
    
    if (distIndex === -1) {
      throw new Error('Expected to find "dist" in path when running from compiled code');
    }
    
    // Go up to project root (one level above dist)
    const levelsUp = pathParts.length - distIndex;
    return path.join(__dirname, '../'.repeat(levelsUp));
  } else {
    // Running from source code (src/ or src/tools/ or src/utils/)
    // Find how many levels deep we are in the src directory
    const pathParts = __dirname.split(path.sep);
    const srcIndex = pathParts.findIndex(part => part === 'src');
    
    if (srcIndex === -1) {
      throw new Error('Expected to find "src" in path when running from source code');
    }
    
    // Go up to project root (one level above src)
    const levelsUp = pathParts.length - srcIndex;
    return path.join(__dirname, '../'.repeat(levelsUp));
  }
}

/**
 * Gets the absolute path to the mcp-debug.log file in the project root.
 * 
 * @param currentFileUrl - The import.meta.url of the calling file
 * @returns Absolute path to the log file
 */
export function getLogFilePath(currentFileUrl: string): string {
  const projectRoot = getProjectRoot(currentFileUrl);
  return path.join(projectRoot, 'mcp-debug.log');
}

/**
 * Creates a logging function that writes to the project root mcp-debug.log file.
 * 
 * @param currentFileUrl - The import.meta.url of the calling file
 * @param prefix - Optional prefix for log messages (e.g., 'CLIENT', 'QUERY-TOOLS')
 * @returns Logging function
 */
export function createLogger(currentFileUrl: string, prefix = ''): (level: string, message: string, data?: any) => void {
  const logFile = getLogFilePath(currentFileUrl);
  const logPrefix = prefix ? `${prefix} ` : '';
  
  return (level: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${logPrefix}${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
    fs.appendFileSync(logFile, logEntry);
    console.error(`${logPrefix}${level}: ${message}`, data || '');
  };
}