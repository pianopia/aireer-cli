import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from './api-client.js';
import { LogManager } from './log-manager.js';
import { AuthManager } from './auth-manager.js';

interface ParallelConfig {
  baseUrl: string;
  endpoints: string[];
  count: number;
  concurrent: number;
  authManager: AuthManager;
}

export async function runParallelRequests(config: ParallelConfig): Promise<void> {
  const apiClient = new ApiClient(config.baseUrl);
  
  // 認証トークンを設定
  const token = config.authManager.getConfigManager().getToken();
  if (token) {
    apiClient.setAuthToken(token);
  }
  
  const logManager = new LogManager();
  
  console.log(chalk.green('⚡ 並列実行を開始します...\n'));

  // 全てのタスクを生成
  const tasks: (() => Promise<any>)[] = [];
  
  for (let i = 0; i < config.count; i++) {
    for (const endpoint of config.endpoints) {
      tasks.push(async () => {
        const taskId = `${endpoint}#${i + 1}`;
        try {
          const result = await apiClient.get(endpoint);
          logManager.log('success', taskId, result);
          return { taskId, success: true, result };
        } catch (error) {
          logManager.log('error', taskId, error);
          return { taskId, success: false, error };
        }
      });
    }
  }

  // 進捗表示用のスピナー
  const spinner = ora(`${tasks.length} 個のタスクを並列実行中... (並列数: ${config.concurrent})`).start();
  
  const startTime = Date.now();
  
  try {
    // 並列実行
    const results = await executeConcurrently(tasks, config.concurrent);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    spinner.succeed(chalk.green(`全タスク完了 (実行時間: ${duration}秒)`));
    
    // 結果の集計
    const stats = logManager.getStats();
    const totalTasks = results.length;
    
    console.log(chalk.blue('\n📊 実行結果:'));
    console.log(chalk.green(`  ✓ 成功: ${stats.success}/${totalTasks}`));
    console.log(chalk.red(`  ✗ 失敗: ${stats.error}/${totalTasks}`));
    console.log(chalk.gray(`  ⏱️  実行時間: ${duration}秒`));
    console.log(chalk.gray(`  🚀 スループット: ${(totalTasks / parseFloat(duration)).toFixed(2)} req/sec`));
    
    // エラーがあった場合の詳細表示
    if (stats.error > 0) {
      console.log(chalk.yellow('\n⚠️  エラーの詳細:'));
      logManager.getErrors().forEach(({ taskId, error }) => {
        console.log(chalk.red(`  ${taskId}: ${error}`));
      });
    }
    
  } catch (error) {
    spinner.fail(chalk.red('並列実行中にエラーが発生しました'));
    console.error(error);
    process.exit(1);
  }
}

async function executeConcurrently<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<any>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const promise = task().then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });

    results.push(promise as any);
    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
} 