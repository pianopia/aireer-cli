import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  timestamp: string;
  type: 'success' | 'error' | 'warning' | 'info';
  taskId: string;
  data: any;
}

interface Stats {
  success: number;
  error: number;
  warning: number;
  total: number;
}

interface ErrorEntry {
  taskId: string;
  error: string;
  type: string;
  stack?: string;
  context?: any;
}

type ErrorType = 
  | 'RATE_LIMIT_ERROR'
  | 'LLM_API_ERROR' 
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'FILE_OPERATION_ERROR'
  | 'ROUTINE_EXECUTION_ERROR'
  | 'UNKNOWN_ERROR';

export class LogManager {
  private logs: LogEntry[] = [];
  private errors: ErrorEntry[] = [];
  private logDirectory: string;
  private currentLogFile: string;

  constructor(directory: string = '.') {
    this.logDirectory = path.join(directory, '.aireer-logs');
    this.ensureLogDirectory();
    this.currentLogFile = path.join(this.logDirectory, `aireer-${new Date().toISOString().split('T')[0]}.log`);
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  log(type: 'success' | 'error' | 'warning' | 'info', taskId: string, data: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type,
      taskId,
      data,
    };

    this.logs.push(entry);

    if (type === 'error') {
      this.errors.push({
        taskId,
        error: data instanceof Error ? data.message : String(data),
        type: 'UNKNOWN_ERROR',
      });
    }

    // ファイルにも出力
    this.writeToFile(entry);
  }

  logError(taskId: string, error: any, errorType: ErrorType, context?: any, apiResponse?: any): string {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const errorEntry: ErrorEntry = {
      taskId,
      error: error instanceof Error ? error.message : String(error),
      type: errorType,
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };

    this.errors.push(errorEntry);

    // Write detailed error log to file
    this.writeDetailedErrorToFile(errorId, errorEntry, error, apiResponse);

    // Display only brief message in CLI
    const simpleMessage = this.getSimpleErrorMessage(errorType, errorId);
    console.error(chalk.red(simpleMessage));

    return errorId;
  }

  logSuccess(taskId: string, data: any, apiResponse?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'success',
      taskId,
      data,
    };

    this.logs.push(entry);

    // Save to detailed log file if API response exists
    if (apiResponse) {
      this.writeSuccessLogToFile(taskId, data, apiResponse);
    }

    // Also output to regular log file
    this.writeToFile(entry);
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const logLine = `[${entry.timestamp}] ${entry.type.toUpperCase()} ${entry.taskId}: ${JSON.stringify(entry.data)}\n`;
      fs.appendFileSync(this.currentLogFile, logLine);
    } catch (error) {
      // Ignore log file write errors (console output only)
    }
  }

  private writeDetailedErrorToFile(errorId: string, errorEntry: ErrorEntry, originalError: any, apiResponse?: any): void {
    try {
      const errorLogFile = path.join(this.logDirectory, `error-${errorId}.json`);
      
              const detailedError = {
          errorId,
          timestamp: new Date().toISOString(),
          taskId: errorEntry.taskId,
          errorType: errorEntry.type,
          message: errorEntry.error,
          stack: errorEntry.stack,
          context: errorEntry.context,
          apiResponse: apiResponse ? this.sanitizeApiResponse(apiResponse) : null,
          originalError: {
            name: originalError?.name,
            message: originalError?.message,
            status: originalError?.status,
            code: originalError?.code,
            response: originalError?.response?.data,
            config: originalError?.config ? {
              url: originalError.config.url,
              method: originalError.config.method,
              timeout: originalError.config.timeout,
            } : undefined,
          },
          environment: {
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            cwd: process.cwd(),
          }
        };

      fs.writeFileSync(errorLogFile, JSON.stringify(detailedError, null, 2));
      
      console.log(chalk.gray(`📝 Detailed error log: ${errorLogFile}`));
    } catch (writeError) {
      console.log(chalk.yellow('⚠️  Failed to write error log file'));
    }
  }

  private getSimpleErrorMessage(errorType: ErrorType, errorId: string): string {
    const messages = {
      RATE_LIMIT_ERROR: `❌ Rate limit error (${errorId})`,
      LLM_API_ERROR: `❌ LLM API error (${errorId})`,
      NETWORK_ERROR: `❌ Network error (${errorId})`,
      VALIDATION_ERROR: `❌ Input validation error (${errorId})`,
      FILE_OPERATION_ERROR: `❌ File operation error (${errorId})`,
      ROUTINE_EXECUTION_ERROR: `❌ Routine execution error (${errorId})`,
      UNKNOWN_ERROR: `❌ Unknown error (${errorId})`,
    };

    return messages[errorType] || `❌ Error (${errorId})`;
  }

  private writeSuccessLogToFile(taskId: string, data: any, apiResponse: any): void {
    try {
      const successId = `SUCCESS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const successLogFile = path.join(this.logDirectory, `success-${successId}.json`);
      
      const detailedSuccess = {
        successId,
        timestamp: new Date().toISOString(),
        taskId,
        data,
        apiResponse: this.sanitizeApiResponse(apiResponse),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          cwd: process.cwd(),
        }
      };

      fs.writeFileSync(successLogFile, JSON.stringify(detailedSuccess, null, 2));
      console.log(chalk.gray(`📝 Detailed success log: ${successLogFile}`));
    } catch (writeError) {
      console.log(chalk.yellow('⚠️  Failed to write success log file'));
    }
  }

  private sanitizeApiResponse(response: any): any {
    try {
      // Safely sanitize API response for logging
      if (typeof response === 'string') {
        try {
          return JSON.parse(response);
        } catch {
          return { raw: response };
        }
      }
      
      if (response && typeof response === 'object') {
        // Truncate responses that are too large
        const responseString = JSON.stringify(response);
        if (responseString.length > 50000) {
          return {
            ...response,
            _truncated: true,
            _originalSize: responseString.length,
            _message: 'Response was truncated due to large size'
          };
        }
        return response;
      }
      
      return response;
    } catch (error) {
      return {
        _error: 'Failed to sanitize response',
        _original: String(response)
      };
    }
  }

  getStats(): Stats {
    const success = this.logs.filter(log => log.type === 'success').length;
    const error = this.logs.filter(log => log.type === 'error').length;
    const warning = this.logs.filter(log => log.type === 'warning').length;
    return {
      success,
      error,
      warning,
      total: success + error + warning,
    };
  }

  getErrors(): ErrorEntry[] {
    return this.errors;
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
    this.errors = [];
  }

  getLogsByType(type: 'success' | 'error'): LogEntry[] {
    return this.logs.filter(log => log.type === type);
  }

  exportToJson(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      logs: this.logs,
      errors: this.errors,
    }, null, 2);
  }
} 