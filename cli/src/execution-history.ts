import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from './api-client.js';

export interface ExecutionDetail {
  id: string;
  routineId: string;
  routineName: string;
  success: boolean;
  message: string;
  error?: string;
  duration: number;
  executedAt: string;
  llmPrompt?: string;
  llmResponse?: any;
  fileOperations?: FileOperation[];
  systemContext?: {
    directory: string;
    timestamp: string;
    cycleCount?: number;
  };
}

export interface FileOperation {
  type: 'create' | 'change' | 'delete' | 'execute' | 'done';
  filepath?: string;
  command?: string;
  success: boolean;
  error?: string;
}

export interface ExecutionSummary {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDuration: number;
  lastExecution?: string;
  routineBreakdown: Record<string, {
    name: string;
    executions: number;
    successes: number;
    failures: number;
    avgDuration: number;
  }>;
}

export class ExecutionHistory {
  private apiClient: ApiClient;
  private localHistoryFile: string;
  private maxLocalHistory: number = 1000; // ローカルに保存する最大履歴数

  constructor(apiClient: ApiClient, configDirectory: string = '.') {
    this.apiClient = apiClient;
    this.localHistoryFile = path.join(configDirectory, '.aireer-execution-history.json');
  }

  /**
   * 実行履歴をAPIとローカルの両方に記録
   */
  async recordExecution(execution: ExecutionDetail): Promise<void> {
    try {
      // API に実行履歴を記録
      await this.saveToApi(execution);
      console.log(chalk.green('✅ 実行履歴をAPIに保存しました'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  API への履歴保存に失敗しました（ローカルには保存されます）'));
      console.log(chalk.gray(`   エラー: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }

    // ローカルファイルにも保存（バックアップとして）
    try {
      await this.saveToLocal(execution);
      console.log(chalk.blue('💾 実行履歴をローカルに保存しました'));
    } catch (error) {
      console.log(chalk.red('❌ ローカルファイルへの履歴保存に失敗しました'));
      console.error(error);
    }
  }

  /**
   * APIに実行履歴を保存
   */
  private async saveToApi(execution: ExecutionDetail): Promise<void> {
    const apiData = {
      routineId: execution.routineId,
      routineName: execution.routineName,
      success: execution.success,
      message: execution.message,
      error: execution.error,
      duration: execution.duration,
      executedAt: execution.executedAt
    };

    await this.apiClient.post('/api/routine-executions', apiData);
  }

  /**
   * ローカルファイルに実行履歴を保存
   */
  private async saveToLocal(execution: ExecutionDetail): Promise<void> {
    let history: ExecutionDetail[] = [];

    // 既存の履歴を読み込み
    if (fs.existsSync(this.localHistoryFile)) {
      try {
        const data = fs.readFileSync(this.localHistoryFile, 'utf-8');
        history = JSON.parse(data);
      } catch (error) {
        console.log(chalk.yellow('⚠️  既存の履歴ファイルの読み込みに失敗しました。新しい履歴を開始します。'));
        history = [];
      }
    }

    // 新しい実行履歴を追加
    history.unshift(execution); // 最新の履歴を先頭に追加

    // 最大履歴数を超えた場合は古い履歴を削除
    if (history.length > this.maxLocalHistory) {
      history = history.slice(0, this.maxLocalHistory);
    }

    // ファイルに保存
    fs.writeFileSync(this.localHistoryFile, JSON.stringify(history, null, 2));
  }

  /**
   * APIから実行履歴を取得
   */
  async fetchFromApi(limit: number = 50, routineId?: string): Promise<ExecutionDetail[]> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      if (routineId) {
        queryParams.append('routineId', routineId);
      }

      const response = await this.apiClient.get(`/api/routine-executions?${queryParams.toString()}`);
      
      if (response.success && response.data) {
        return response.data.map((item: any) => ({
          id: item.id,
          routineId: item.routineId,
          routineName: item.routineName,
          success: item.success,
          message: item.message,
          error: item.error,
          duration: 0, // APIには duration が保存されていない
          executedAt: item.executedAt
        }));
      }
      return [];
    } catch (error) {
      console.log(chalk.yellow('⚠️  APIからの履歴取得に失敗しました。ローカル履歴を使用します。'));
      return this.getLocalHistory(limit);
    }
  }

  /**
   * ローカルファイルから実行履歴を取得
   */
  getLocalHistory(limit: number = 50): ExecutionDetail[] {
    try {
      if (!fs.existsSync(this.localHistoryFile)) {
        return [];
      }

      const data = fs.readFileSync(this.localHistoryFile, 'utf-8');
      const history: ExecutionDetail[] = JSON.parse(data);
      
      return history.slice(0, limit);
    } catch (error) {
      console.log(chalk.red('❌ ローカル履歴ファイルの読み込みに失敗しました'));
      return [];
    }
  }

  /**
   * 実行履歴の統計情報を取得
   */
  async getExecutionSummary(days: number = 7): Promise<ExecutionSummary> {
    const history = await this.fetchFromApi(1000); // 十分な数を取得
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 指定期間内の履歴をフィルタ
    const recentHistory = history.filter(h => new Date(h.executedAt) > cutoffDate);

    const totalExecutions = recentHistory.length;
    const successfulExecutions = recentHistory.filter(h => h.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    // 持続時間の平均（ローカル履歴から）
    const localHistory = this.getLocalHistory(1000);
    const recentLocalHistory = localHistory.filter(h => new Date(h.executedAt) > cutoffDate);
    const durationsWithValue = recentLocalHistory.filter(h => h.duration > 0).map(h => h.duration);
    const averageDuration = durationsWithValue.length > 0 
      ? durationsWithValue.reduce((sum, d) => sum + d, 0) / durationsWithValue.length 
      : 0;

    const lastExecution = recentHistory.length > 0 ? recentHistory[0].executedAt : undefined;

    // ルーチン別の統計
    const routineBreakdown: Record<string, any> = {};
    recentHistory.forEach(h => {
      if (!routineBreakdown[h.routineId]) {
        routineBreakdown[h.routineId] = {
          name: h.routineName,
          executions: 0,
          successes: 0,
          failures: 0,
          durations: []
        };
      }
      
      routineBreakdown[h.routineId].executions++;
      if (h.success) {
        routineBreakdown[h.routineId].successes++;
      } else {
        routineBreakdown[h.routineId].failures++;
      }

      // ローカル履歴から持続時間を取得
      const localExecution = recentLocalHistory.find(lh => 
        lh.routineId === h.routineId && lh.executedAt === h.executedAt
      );
      if (localExecution && localExecution.duration > 0) {
        routineBreakdown[h.routineId].durations.push(localExecution.duration);
      }
    });

    // 平均持続時間を計算
    Object.keys(routineBreakdown).forEach(routineId => {
      const durations = routineBreakdown[routineId].durations;
      routineBreakdown[routineId].avgDuration = durations.length > 0
        ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length
        : 0;
      delete routineBreakdown[routineId].durations; // 不要な配列を削除
    });

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
      lastExecution,
      routineBreakdown
    };
  }

  /**
   * 実行履歴を表示
   */
  async displayHistory(limit: number = 20, routineId?: string): Promise<void> {
    console.log(chalk.blue('📊 実行履歴を取得中...'));
    
    const history = await this.fetchFromApi(limit, routineId);
    
    if (history.length === 0) {
      console.log(chalk.yellow('📝 実行履歴がありません'));
      return;
    }

    console.log(chalk.green(`✅ ${history.length}件の実行履歴が見つかりました\n`));

    history.forEach((execution, index) => {
      const status = execution.success 
        ? chalk.green('✅ 成功') 
        : chalk.red('❌ 失敗');
      
      const executedAt = new Date(execution.executedAt).toLocaleString('ja-JP');
      
      console.log(chalk.white(`${index + 1}. ${execution.routineName} ${status}`));
      console.log(chalk.gray(`   実行時刻: ${executedAt}`));
      console.log(chalk.gray(`   メッセージ: ${execution.message}`));
      if (execution.error) {
        console.log(chalk.red(`   エラー: ${execution.error}`));
      }
      if (execution.duration > 0) {
        console.log(chalk.gray(`   実行時間: ${execution.duration}ms`));
      }
      console.log('');
    });
  }

  /**
   * 実行統計を表示
   */
  async displaySummary(days: number = 7): Promise<void> {
    console.log(chalk.blue(`📈 過去${days}日間の実行統計を取得中...`));
    
    const summary = await this.getExecutionSummary(days);
    
    console.log(chalk.cyan(`\n📊 実行統計 (過去${days}日間)`));
    console.log(chalk.white(`総実行数: ${summary.totalExecutions}`));
    console.log(chalk.green(`成功: ${summary.successfulExecutions}`));
    console.log(chalk.red(`失敗: ${summary.failedExecutions}`));
    console.log(chalk.yellow(`成功率: ${summary.successRate}%`));
    
    if (summary.averageDuration > 0) {
      console.log(chalk.gray(`平均実行時間: ${summary.averageDuration}ms`));
    }
    
    if (summary.lastExecution) {
      console.log(chalk.gray(`最終実行: ${new Date(summary.lastExecution).toLocaleString('ja-JP')}`));
    }

    // ルーチン別統計
    if (Object.keys(summary.routineBreakdown).length > 0) {
      console.log(chalk.cyan('\n📋 ルーチン別統計:'));
      Object.entries(summary.routineBreakdown).forEach(([routineId, stats]) => {
        const successRate = stats.executions > 0 
          ? Math.round((stats.successes / stats.executions) * 100) 
          : 0;
        
        console.log(chalk.white(`  ${stats.name}:`));
        console.log(chalk.gray(`    実行: ${stats.executions}回  成功: ${stats.successes}回  失敗: ${stats.failures}回  成功率: ${successRate}%`));
        if (stats.avgDuration > 0) {
          console.log(chalk.gray(`    平均実行時間: ${Math.round(stats.avgDuration)}ms`));
        }
      });
    }
  }

  /**
   * 実行履歴をクリア（ローカルのみ）
   */
  clearLocalHistory(): void {
    try {
      if (fs.existsSync(this.localHistoryFile)) {
        fs.unlinkSync(this.localHistoryFile);
        console.log(chalk.green('✅ ローカル実行履歴をクリアしました'));
      } else {
        console.log(chalk.yellow('📝 クリアする履歴がありません'));
      }
    } catch (error) {
      console.log(chalk.red('❌ 履歴のクリアに失敗しました'));
      console.error(error);
    }
  }

  /**
   * 特定のルーチンの最近の実行結果を要約して重複回避のための情報を返す
   */
  async getPreviousExecutionsSummary(routineId: string, limit: number = 5): Promise<string> {
    try {
      // ローカル履歴から最新の実行結果を取得
      const localHistory = this.getLocalHistory(50);
      const routineHistory = localHistory
        .filter(h => h.routineId === routineId)
        .slice(0, limit);

      if (routineHistory.length === 0) {
        return '前回の実行履歴はありません。新しいアプローチで取り組んでください。';
      }

      let summary = `【前回の実行履歴（重複を避けるため参考にしてください）】\n`;
      
      routineHistory.forEach((execution, index) => {
        const executedTime = new Date(execution.executedAt).toLocaleString('ja-JP');
        const status = execution.success ? '成功' : '失敗';
        
        summary += `${index + 1}. ${executedTime} - ${status}\n`;
        summary += `   実行内容: ${execution.message}\n`;
        
        if (execution.llmResponse) {
          try {
            const response = typeof execution.llmResponse === 'string' 
              ? JSON.parse(execution.llmResponse) 
              : execution.llmResponse;
            
            if (response.type) {
              summary += `   実行種別: ${response.type}\n`;
            }
            if (response.filepath) {
              summary += `   対象ファイル: ${response.filepath}\n`;
            }
            if (response.command) {
              summary += `   実行コマンド: ${response.command}\n`;
            }
          } catch (error) {
            // JSONパースに失敗した場合はそのまま表示
            summary += `   LLMレスポンス: ${String(execution.llmResponse).substring(0, 100)}...\n`;
          }
        }
        
        if (execution.fileOperations && execution.fileOperations.length > 0) {
          summary += `   ファイル操作: `;
          const operations = execution.fileOperations
            .map(op => `${op.type}(${op.filepath || op.command || 'N/A'})`)
            .join(', ');
          summary += `${operations}\n`;
        }
        
        if (execution.error) {
          summary += `   エラー: ${execution.error}\n`;
        }
        
        summary += `\n`;
      });

      summary += `【重要】上記の実行内容と同じことは避けて、新しい観点や手法でタスクを実行してください。\n`;
      summary += `既に実行済みのファイル作成・変更・コマンドは重複しないようにしてください。\n`;

      return summary;
    } catch (error) {
      console.log(chalk.yellow('⚠️  前回実行履歴の要約生成に失敗しました'));
      return '前回の実行履歴の取得に失敗しました。新しいアプローチで取り組んでください。';
    }
  }

  /**
   * 実行されたファイル操作の重複チェック用リストを取得
   */
  async getRecentFileOperations(routineId: string, hours: number = 24): Promise<string[]> {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const localHistory = this.getLocalHistory(100);
      
      const recentExecutions = localHistory.filter(h => 
        h.routineId === routineId && 
        new Date(h.executedAt) > cutoffTime
      );

      const fileOperations = new Set<string>();
      
      recentExecutions.forEach(execution => {
        if (execution.fileOperations) {
          execution.fileOperations.forEach(op => {
            if (op.filepath) {
              fileOperations.add(`${op.type}:${op.filepath}`);
            } else if (op.command) {
              fileOperations.add(`execute:${op.command}`);
            }
          });
        }
        
        // LLMレスポンスからも操作を抽出
        if (execution.llmResponse) {
          try {
            const response = typeof execution.llmResponse === 'string' 
              ? JSON.parse(execution.llmResponse) 
              : execution.llmResponse;
            
            if (response.filepath && response.type) {
              fileOperations.add(`${response.type}:${response.filepath}`);
            }
            if (response.command) {
              fileOperations.add(`execute:${response.command}`);
            }
          } catch (error) {
            // JSONパースエラーは無視
          }
        }
      });

      return Array.from(fileOperations);
    } catch (error) {
      console.log(chalk.yellow('⚠️  最近のファイル操作の取得に失敗しました'));
      return [];
    }
  }
} 