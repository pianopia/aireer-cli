import inquirer from 'inquirer';
import chalk from 'chalk';
import { startScheduler } from './scheduler.js';
import { runParallelRequests } from './parallel.js';
import { AuthManager } from './auth-manager.js';
import { ConfigManager } from './config-manager.js';

interface InteractiveConfig {
  mode: 'schedule' | 'parallel';
  baseUrl: string;
  endpoints: string[];
  interval?: number;
  count?: number;
  concurrent: number;
}

export async function setupInteractiveMode(): Promise<void> {
  console.log(chalk.blue('🎯 インタラクティブ設定モード'));
  console.log(chalk.gray('設定項目を順番に入力してください\n'));

  try {
    // AuthManagerインスタンスを作成
    const configManager = new ConfigManager();
    const authManager = new AuthManager('config.json');

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: '実行モードを選択してください:',
        choices: [
          { name: '🔄 定期実行モード - 指定した間隔でAPIを継続実行', value: 'schedule' },
          { name: '⚡ 並列実行モード - 指定した回数のAPIを並列実行', value: 'parallel' },
        ],
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'APIのベースURLを入力してください:',
        default: 'http://localhost:3000',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return '有効なURLを入力してください';
          }
        },
      },
      {
        type: 'checkbox',
        name: 'endpoints',
        message: '実行するエンドポイントを選択してください (スペースキーで選択):',
        choices: [
          { name: '/api/todos - Todo管理API', value: '/api/todos', checked: true },
          { name: '/api/routines - ルーチン管理API', value: '/api/routines', checked: true },
          { name: '/api/messages - メッセージ管理API', value: '/api/messages', checked: true },
          { name: '/api/ai-personality - AI性格管理API', value: '/api/ai-personality' },
          { name: '/api/routine-executions - ルーチン実行管理API', value: '/api/routine-executions' },
          { name: '/ - ヘルスチェック', value: '/' },
        ],
        validate: (input: string[]) => {
          return input.length > 0 ? true : '最低1つのエンドポイントを選択してください';
        },
      },
      {
        type: 'input',
        name: 'interval',
        message: '実行間隔を秒単位で入力してください:',
        default: '30',
        when: (answers: any) => answers.mode === 'schedule',
        validate: (input: string) => {
          const num = parseInt(input);
          return num > 0 ? true : '正の数値を入力してください';
        },
      },
      {
        type: 'input',
        name: 'count',
        message: '各エンドポイントの実行回数を入力してください:',
        default: '5',
        when: (answers: any) => answers.mode === 'parallel',
        validate: (input: string) => {
          const num = parseInt(input);
          return num > 0 ? true : '正の数値を入力してください';
        },
      },
      {
        type: 'input',
        name: 'concurrent',
        message: '並列実行数を入力してください:',
        default: (answers: any) => answers.mode === 'schedule' ? '3' : '10',
        validate: (input: string) => {
          const num = parseInt(input);
          return num > 0 && num <= 50 ? true : '1から50の数値を入力してください';
        },
      },
    ]);

    const config: InteractiveConfig = {
      mode: answers.mode,
      baseUrl: answers.baseUrl,
      endpoints: answers.endpoints,
      concurrent: parseInt(answers.concurrent),
    };

    if (answers.mode === 'schedule') {
      config.interval = parseInt(answers.interval);
    } else {
      config.count = parseInt(answers.count);
    }

    // 設定確認
    console.log(chalk.cyan('\n📋 設定確認:'));
    console.log(chalk.gray(`モード: ${config.mode === 'schedule' ? '定期実行' : '並列実行'}`));
    console.log(chalk.gray(`ベースURL: ${config.baseUrl}`));
    console.log(chalk.gray(`エンドポイント: ${config.endpoints.join(', ')}`));
    if (config.mode === 'schedule') {
      console.log(chalk.gray(`実行間隔: ${config.interval}秒`));
    } else {
      console.log(chalk.gray(`実行回数: ${config.count}回`));
    }
    console.log(chalk.gray(`並列実行数: ${config.concurrent}`));

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'この設定で実行しますか?',
        default: true,
      },
    ]);

    if (!confirmed) {
      console.log(chalk.yellow('実行をキャンセルしました'));
      return;
    }

    // 実行開始
    if (config.mode === 'schedule') {
      await startScheduler({
        baseUrl: config.baseUrl,
        interval: config.interval!,
        endpoints: config.endpoints,
        concurrent: config.concurrent,
        authManager,
      });
    } else {
      await runParallelRequests({
        baseUrl: config.baseUrl,
        endpoints: config.endpoints,
        count: config.count!,
        concurrent: config.concurrent,
        authManager,
      });
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log(chalk.yellow('\n操作がキャンセルされました'));
    } else {
      console.error(chalk.red('インタラクティブモードでエラーが発生しました:'), error);
    }
  }
} 