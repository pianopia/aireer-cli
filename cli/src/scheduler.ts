import cron from 'node-cron';
import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from './api-client.js';
import { LogManager } from './log-manager.js';
import { AuthManager } from './auth-manager.js';

interface SchedulerConfig {
  baseUrl: string;
  interval: number;
  endpoints: string[];
  concurrent: number;
  authManager: AuthManager;
}

export async function startScheduler(config: SchedulerConfig): Promise<void> {
  const apiClient = new ApiClient(config.baseUrl);
  
  // 認証トークンを設定
  const token = config.authManager.getConfigManager().getToken();
  if (token) {
    apiClient.setAuthToken(token);
  }
  
  const logManager = new LogManager();
  
  // Ctrl+Cで停止するためのハンドラー
  let isRunning = true;
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⏹️  スケジューラーを停止しています...'));
    isRunning = false;
    process.exit(0);
  });

  // cronフォーマットに変換（秒間隔）
  const cronPattern = `*/${config.interval} * * * * *`;
  
  console.log(chalk.green(`📅 スケジューラーが開始されました (間隔: ${config.interval}秒)`));
  console.log(chalk.gray('停止するには Ctrl+C を押してください\n'));

  // 即座に1回実行
  await executeScheduledTask(config, apiClient, logManager);

  // 定期実行を開始
  cron.schedule(cronPattern, async () => {
    if (isRunning) {
      await executeScheduledTask(config, apiClient, logManager);
    }
  });

  // プロセスを維持
  return new Promise(() => {});
}

async function executeScheduledTask(
  config: SchedulerConfig,
  apiClient: ApiClient,
  logManager: LogManager
): Promise<void> {
  const timestamp = new Date().toLocaleString('ja-JP');
  console.log(chalk.cyan(`\n🔄 [${timestamp}] 定期実行を開始...`));

  const tasks = config.endpoints.map(endpoint => async () => {
    const spinner = ora(`${endpoint} を実行中...`).start();
    try {
      const result = await apiClient.get(endpoint);
      logManager.log('success', endpoint, result);
      spinner.succeed(chalk.green(`${endpoint} ✓`));
      return { endpoint, success: true, result };
    } catch (error) {
      logManager.log('error', endpoint, error);
      spinner.fail(chalk.red(`${endpoint} ✗`));
      return { endpoint, success: false, error };
    }
  });

  // 並列実行を制限
  await executeConcurrently(tasks, config.concurrent);
  
  const stats = logManager.getStats();
  console.log(chalk.blue(`📊 実行完了 - 成功: ${stats.success}, 失敗: ${stats.error}`));
}

async function executeConcurrently<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<any>[] = [];

  for (const task of tasks) {
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