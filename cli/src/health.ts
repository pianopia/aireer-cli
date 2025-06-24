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
  console.log(chalk.blue('🔍 Checking API health status...\n'));

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
    const spinner = ora(`Checking ${endpoint}...`).start();
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

  // Display result summary
  console.log(chalk.blue('\n📊 Health check results:'));
  
  const successCount = results.filter(r => r.status === 'ok').length;
  const totalCount = results.length;
  const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalCount;

  console.log(chalk.green(`✓ Success: ${successCount}/${totalCount}`));
  console.log(chalk.red(`✗ Failed: ${totalCount - successCount}/${totalCount}`));
  console.log(chalk.gray(`⏱️  Average response time: ${averageResponseTime.toFixed(2)}ms`));

  // Display error details
  const errors = results.filter(r => r.status === 'error');
  if (errors.length > 0) {
    console.log(chalk.yellow('\n⚠️  Error details:'));
    errors.forEach(error => {
      console.log(chalk.red(`  ${error.endpoint}: ${error.details}`));
    });
  }

  // Overall health status
  const healthPercentage = (successCount / totalCount) * 100;
  if (healthPercentage === 100) {
    console.log(chalk.green('\n🎉 API is in perfect health!'));
  } else if (healthPercentage >= 80) {
    console.log(chalk.yellow('\n⚠️  API is generally healthy but has some issues'));
  } else if (healthPercentage >= 50) {
    console.log(chalk.red('\n🚨 API has serious problems'));
  } else {
    console.log(chalk.red('\n💀 API is barely functioning'));
  }
} 