import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from './api-client.js';

interface HealthCheckResult {
  endpoint: string;
  status: 'ok' | 'error';
  responseTime: number;
  details: any;
}

export async function checkApiHealth(baseUrl: string): Promise<void> {
  console.log(chalk.blue('🔍 API健康状態をチェックしています...\n'));

  const apiClient = new ApiClient(baseUrl);
  const endpoints = [
    '/',
    '/api/todos',
    '/api/routines',
    '/api/messages',
    '/api/ai-personality',
    '/api/routine-executions',
  ];

  const results: HealthCheckResult[] = [];

  for (const endpoint of endpoints) {
    const spinner = ora(`${endpoint} をチェック中...`).start();
    const startTime = Date.now();

    try {
      const response = await apiClient.get(endpoint);
      const responseTime = Date.now() - startTime;

      results.push({
        endpoint,
        status: 'ok',
        responseTime,
        details: response,
      });

      spinner.succeed(chalk.green(`${endpoint} ✓ (${responseTime}ms)`));
    } catch (error) {
      const responseTime = Date.now() - startTime;

      results.push({
        endpoint,
        status: 'error',
        responseTime,
        details: error instanceof Error ? error.message : String(error),
      });

      spinner.fail(chalk.red(`${endpoint} ✗ (${responseTime}ms)`));
    }
  }

  // 結果サマリーを表示
  console.log(chalk.blue('\n📊 健康状態チェック結果:'));
  
  const successCount = results.filter(r => r.status === 'ok').length;
  const totalCount = results.length;
  const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalCount;

  console.log(chalk.green(`✓ 成功: ${successCount}/${totalCount}`));
  console.log(chalk.red(`✗ 失敗: ${totalCount - successCount}/${totalCount}`));
  console.log(chalk.gray(`⏱️  平均応答時間: ${averageResponseTime.toFixed(2)}ms`));

  // エラーの詳細を表示
  const errors = results.filter(r => r.status === 'error');
  if (errors.length > 0) {
    console.log(chalk.yellow('\n⚠️  エラーの詳細:'));
    errors.forEach(error => {
      console.log(chalk.red(`  ${error.endpoint}: ${error.details}`));
    });
  }

  // 全体的な健康状態
  const healthPercentage = (successCount / totalCount) * 100;
  if (healthPercentage === 100) {
    console.log(chalk.green('\n🎉 APIは完全に健康な状態です！'));
  } else if (healthPercentage >= 80) {
    console.log(chalk.yellow('\n⚠️  APIは概ね健康ですが、一部に問題があります'));
  } else if (healthPercentage >= 50) {
    console.log(chalk.red('\n🚨 APIに重大な問題があります'));
  } else {
    console.log(chalk.red('\n💀 APIがほとんど機能していません'));
  }
} 