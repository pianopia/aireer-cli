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

    // 詳細なエラーログをファイルに出力
    this.writeDetailedErrorToFile(errorId, errorEntry, error, apiResponse);

    // CLIには簡潔なメッセージのみ表示
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

    // APIレスポンスがある場合は詳細ログファイルに保存
    if (apiResponse) {
      this.writeSuccessLogToFile(taskId, data, apiResponse);
    }

    // 通常ログファイルにも出力
    this.writeToFile(entry);
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const logLine = `[${entry.timestamp}] ${entry.type.toUpperCase()} ${entry.taskId}: ${JSON.stringify(entry.data)}\n`;
      fs.appendFileSync(this.currentLogFile, logLine);
    } catch (error) {
      // ログファイル書き込みエラーは無視（コンソールに出力のみ）
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
      
      console.log(chalk.gray(`📝 詳細エラーログ: ${errorLogFile}`));
    } catch (writeError) {
      console.log(chalk.yellow('⚠️  エラーログファイルの書き込みに失敗しました'));
    }
  }

  private getSimpleErrorMessage(errorType: ErrorType, errorId: string): string {
    const messages = {
      RATE_LIMIT_ERROR: `❌ レート制限エラー (${errorId})`,
      LLM_API_ERROR: `❌ LLM API エラー (${errorId})`,
      NETWORK_ERROR: `❌ ネットワークエラー (${errorId})`,
      VALIDATION_ERROR: `❌ 入力検証エラー (${errorId})`,
      FILE_OPERATION_ERROR: `❌ ファイル操作エラー (${errorId})`,
      ROUTINE_EXECUTION_ERROR: `❌ ルーチン実行エラー (${errorId})`,
      UNKNOWN_ERROR: `❌ 不明なエラー (${errorId})`,
    };

    return messages[errorType] || `❌ エラー (${errorId})`;
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
      console.log(chalk.gray(`📝 詳細成功ログ: ${successLogFile}`));
    } catch (writeError) {
      console.log(chalk.yellow('⚠️  成功ログファイルの書き込みに失敗しました'));
    }
  }

  private sanitizeApiResponse(response: any): any {
    try {
      // APIレスポンスを安全に記録用にサニタイズ
      if (typeof response === 'string') {
        try {
          return JSON.parse(response);
        } catch {
          return { raw: response };
        }
      }
      
      if (response && typeof response === 'object') {
        // 大きすぎるレスポンスは切り詰める
        const responseString = JSON.stringify(response);
        if (responseString.length > 50000) {
          return {
            ...response,
            _truncated: true,
            _originalSize: responseString.length,
            _message: 'レスポンスが大きすぎるため切り詰められました'
          };
        }
        return response;
      }
      
      return response;
    } catch (error) {
      return {
        _error: 'レスポンスのサニタイズに失敗',
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