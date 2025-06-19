#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { startScheduler } from './scheduler.js';
import { runParallelRequests } from './parallel.js';
import { setupInteractiveMode } from './interactive.js';
import { startAutonomousMode } from './autonomous-mode.js';
import { RoutineManager } from './routine-manager.js';
import { RoutineCreator } from './routine-creator.js';
import { displayLogo, displayCompactLogo } from './logo.js';
import { AuthManager } from './auth-manager.js';
import { ConfigManager } from './config-manager.js';

const packageJson = {
  version: '1.0.0'
};

program
  .name('aireer')
  .description('完全自律型AIサービス「aireer」のCLIツール')
  .version(packageJson.version);

// ログイン
program
  .command('login')
  .description('aireerにログイン')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .action(async (options: any) => {
    displayCompactLogo();
    const authManager = new AuthManager(options.apiUrl);
    await authManager.login();
  });

// アカウント作成
program
  .command('register')
  .description('新しいaireerアカウントを作成')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .action(async (options: any) => {
    displayCompactLogo();
    const authManager = new AuthManager(options.apiUrl);
    await authManager.register();
  });

// ログアウト
program
  .command('logout')
  .description('aireerからログアウト')
  .action(async () => {
    displayCompactLogo();
    const authManager = new AuthManager();
    await authManager.logout();
  });

// 設定表示・変更
program
  .command('config')
  .description('設定の表示・変更')
  .option('--show', '現在の設定を表示')
  .option('--llm-mode <mode>', 'LLMモードを設定 (api | gemini-direct)')
  .option('--gemini-key <key>', 'Gemini APIキーを設定')
  .option('--gemini-test', 'Gemini API接続テスト')
  .option('--gemini-guide', 'Gemini API設定ガイドを表示')
  .action(async (options: any) => {
    displayCompactLogo();
    const configManager = new ConfigManager();
    
    // Gemini API設定ガイド表示
    if (options.geminiGuide) {
      configManager.displayGeminiSetupGuide();
      return;
    }
    
    // LLMモード設定
    if (options.llmMode) {
      if (options.llmMode === 'api' || options.llmMode === 'gemini-direct') {
        configManager.setLLMMode(options.llmMode);
        console.log(chalk.green(`✅ LLMモードを「${options.llmMode}」に設定しました`));
        
        if (options.llmMode === 'gemini-direct' && !configManager.getGeminiApiKey()) {
          console.log(chalk.yellow('⚠️  Gemini Directモードを使用するには、APIキーの設定が必要です'));
          configManager.displayGeminiSetupGuide();
        }
      } else {
        console.log(chalk.red('❌ 無効なLLMモードです。"api" または "gemini-direct" を指定してください。'));
        return;
      }
    }
    
    // Gemini APIキー設定
    if (options.geminiKey) {
      const { GeminiClient } = await import('./gemini-client.js');
      
      if (!GeminiClient.validateApiKey(options.geminiKey)) {
        console.log(chalk.red('❌ 無効なGemini APIキーの形式です'));
        console.log(chalk.gray('   正しい形式: AIza... (39文字)'));
        return;
      }
      
      configManager.setGeminiApiKey(options.geminiKey);
      console.log(chalk.green('✅ Gemini APIキーを設定しました'));
      
      // 自動的にLLMモードをgemini-directに変更するか確認
      if (configManager.getLLMMode() !== 'gemini-direct') {
        const inquirer = await import('inquirer');
        const { switchMode } = await inquirer.default.prompt([{
          type: 'confirm',
          name: 'switchMode',
          message: 'LLMモードをGemini Directに切り替えますか？',
          default: true
        }]);
        
        if (switchMode) {
          configManager.setLLMMode('gemini-direct');
          console.log(chalk.green('✅ LLMモードをGemini Directに切り替えました'));
        }
      }
    }
    
    // Gemini API接続テスト
    if (options.geminiTest) {
      const apiKey = configManager.getGeminiApiKey();
      if (!apiKey) {
        console.log(chalk.red('❌ Gemini APIキーが設定されていません'));
        configManager.displayGeminiSetupGuide();
        return;
      }
      
      try {
        const { GeminiClient } = await import('./gemini-client.js');
        const geminiClient = new GeminiClient(apiKey);
        const success = await geminiClient.testConnection();
        
        if (success) {
          console.log(chalk.green('🎉 Gemini API接続テスト成功！'));
        } else {
          console.log(chalk.red('❌ Gemini API接続テスト失敗'));
        }
      } catch (error) {
        console.log(chalk.red('❌ Gemini API接続テスト失敗'));
        console.error(error);
      }
      return;
    }
    
    // デフォルト動作: 設定表示
    if (!options.llmMode && !options.geminiKey && !options.geminiTest) {
      configManager.displayConfig();
    }
  });

// 自律実行モード（メイン機能）
program
  .command('autonomous')
  .alias('auto')
  .description('完全自律モード - 思考ルーチンを取得して優先度に基づいて自動実行')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .option('-d, --directory <directory>', '作業ディレクトリ', '.')
  .option('-i, --interval <seconds>', '実行サイクル間隔（秒）', '60')
  .option('-e, --llm-endpoint <endpoint>', 'LLMエンドポイント', '/api/llm/generate')
  .option('-m, --max-executions <number>', '1サイクルあたりの最大実行数', '3')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    const configManager = authManager.getConfigManager();
    
    // LLMモードに応じた認証チェック
    const llmMode = configManager.getLLMMode();
    const useGeminiDirect = llmMode === 'gemini-direct';
    
    if (!useGeminiDirect) {
      // API経由の場合は認証が必要
      if (!(await authManager.ensureAuthenticated())) {
        console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
        process.exit(1);
      }
    } else {
      // Gemini直接の場合はAPIキーが必要
      if (!configManager.isGeminiConfigured()) {
        console.log(chalk.red('❌ Gemini APIキーが設定されていません。'));
        console.log(chalk.cyan('以下のコマンドでAPIキーを設定してください:'));
        console.log(chalk.gray('aireer config --gemini-guide'));
        process.exit(1);
      }
    }

    displayLogo();
    
    let geminiClient;
    if (useGeminiDirect) {
      try {
        const { GeminiClient } = await import('./gemini-client.js');
        const apiKey = configManager.getGeminiApiKey()!;
        geminiClient = new GeminiClient(apiKey);
        
        console.log(chalk.blue('🔍 Gemini API接続確認中...'));
        const connectionOk = await geminiClient.testConnection();
        if (!connectionOk) {
          console.log(chalk.red('❌ Gemini APIに接続できません。APIキーを確認してください。'));
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red('❌ Gemini クライアントの初期化に失敗しました:'), error);
        process.exit(1);
      }
    }
    
    await startAutonomousMode({
      apiUrl: options.apiUrl,
      directory: options.directory,
      interval: parseInt(options.interval),
      llmEndpoint: options.llmEndpoint,
      maxExecutionsPerCycle: parseInt(options.maxExecutions),
      authManager,
      useGeminiDirect,
      geminiClient
    });
  });

// 思考ルーチン管理コマンド
const routineCommand = program
  .command('routine')
  .description('思考ルーチンの作成と管理');

// 思考ルーチン作成
routineCommand
  .command('create')
  .description('新しい思考ルーチンを作成')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // 認証チェック
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
      process.exit(1);
    }

    displayCompactLogo();
    const routineCreator = new RoutineCreator(options.apiUrl, authManager);
    await routineCreator.createThinkingRoutine();
  });

// ルーチン一覧表示
routineCommand
  .command('list')
  .description('登録済みの思考ルーチン一覧を表示')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // 認証チェック
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
      process.exit(1);
    }

    displayCompactLogo();
    const routineCreator = new RoutineCreator(options.apiUrl, authManager);
    await routineCreator.listRoutines();
  });

// 実行履歴表示
routineCommand
  .command('history')
  .description('ルーチンの実行履歴を表示')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .option('-l, --limit <number>', '表示する履歴数', '20')
  .option('-r, --routine-id <id>', '特定のルーチンIDでフィルタ')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // 認証チェック
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
      process.exit(1);
    }

    displayCompactLogo();
    const { ApiClient } = await import('./api-client.js');
    const { ExecutionHistory } = await import('./execution-history.js');
    
    const apiClient = new ApiClient(options.apiUrl);
    const token = authManager.getConfigManager().getToken();
    if (token) {
      apiClient.setAuthToken(token);
    }
    
    const executionHistory = new ExecutionHistory(apiClient);
    await executionHistory.displayHistory(parseInt(options.limit), options.routineId);
  });

// 実行統計表示
routineCommand
  .command('stats')
  .description('ルーチン実行の統計情報を表示')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .option('-d, --days <number>', '過去何日間の統計を表示するか', '7')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // 認証チェック
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
      process.exit(1);
    }

    displayCompactLogo();
    const { ApiClient } = await import('./api-client.js');
    const { ExecutionHistory } = await import('./execution-history.js');
    
    const apiClient = new ApiClient(options.apiUrl);
    const token = authManager.getConfigManager().getToken();
    if (token) {
      apiClient.setAuthToken(token);
    }
    
    const executionHistory = new ExecutionHistory(apiClient);
    await executionHistory.displaySummary(parseInt(options.days));
  });

// ルーチン削除
routineCommand
  .command('delete')
  .alias('remove')
  .alias('rm')
  .description('思考ルーチンを削除する')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .option('-i, --id <routineId>', '削除するルーチンのID (指定しない場合は一覧から選択)')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // 認証チェック
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
      process.exit(1);
    }

    displayCompactLogo();
    const routineCreator = new RoutineCreator(options.apiUrl, authManager);
    await routineCreator.deleteRoutine(options.id);
  });

// 優先度管理コマンド
program
  .command('priority')
  .description('ルーチンの優先度設定を管理')
  .option('-u, --api-url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .option('-d, --directory <directory>', '作業ディレクトリ', '.')
  .option('--show', '現在の優先度設定を表示')
  .option('--set <routineId:priority>', 'ルーチンの優先度を設定 (例: abc123:8)')
  .option('--weight <routineId:weight>', 'ルーチンの重みを設定 (例: abc123:1.5)')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // 認証チェック
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
      process.exit(1);
    }

    displayCompactLogo();
    const routineManager = new RoutineManager(options.apiUrl, options.directory, authManager);
    
    if (options.show) {
      console.log(chalk.blue('📊 ルーチン優先度設定を表示します...'));
      const routines = await routineManager.fetchActiveRoutines();
      routineManager.updateRoutinePriorities(routines);
      await routineManager.getRoutinePriorityInfo();
      return;
    }
    
    if (options.set) {
      const [routineId, priority] = options.set.split(':');
      if (routineId && priority) {
        routineManager.adjustPriority(routineId, parseInt(priority));
      } else {
        console.log(chalk.red('❌ 形式が正しくありません。例: --set abc123:8'));
      }
      return;
    }
    
    if (options.weight) {
      const [routineId, weight] = options.weight.split(':');
      if (routineId && weight) {
        routineManager.adjustWeight(routineId, parseFloat(weight));
      } else {
        console.log(chalk.red('❌ 形式が正しくありません。例: --weight abc123:1.5'));
      }
      return;
    }
    
    // デフォルト：優先度設定を表示
    console.log(chalk.blue('📊 ルーチン優先度設定を表示します...'));
    const routines = await routineManager.fetchActiveRoutines();
    routineManager.updateRoutinePriorities(routines);
    await routineManager.getRoutinePriorityInfo();
  });

program
  .command('schedule')
  .description('定期実行でAPIを叩き続ける')
  .option('-u, --url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .option('-i, --interval <seconds>', '実行間隔（秒）', '30')
  .option('-e, --endpoints <endpoints>', 'カンマ区切りのエンドポイント', '/api/todos,/api/routines,/api/messages')
  .option('-c, --concurrent <number>', '並列実行数', '3')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.url);
    
    // 認証チェック
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
      process.exit(1);
    }

    console.log(chalk.blue('🚀 定期実行モードを開始します...'));
    console.log(chalk.gray(`ベースURL: ${options.url}`));
    console.log(chalk.gray(`実行間隔: ${options.interval}秒`));
    console.log(chalk.gray(`エンドポイント: ${options.endpoints}`));
    console.log(chalk.gray(`並列実行数: ${options.concurrent}`));
    
    const endpoints = options.endpoints.split(',').map((ep: string) => ep.trim());
    await startScheduler({
      baseUrl: options.url,
      interval: parseInt(options.interval),
      endpoints,
      concurrent: parseInt(options.concurrent),
      authManager
    });
  });

program
  .command('parallel')
  .description('並列でAPIリクエストを実行')
  .option('-u, --url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .option('-e, --endpoints <endpoints>', 'カンマ区切りのエンドポイント', '/api/todos,/api/routines,/api/messages')
  .option('-c, --count <number>', '各エンドポイントの実行回数', '5')
  .option('-t, --threads <number>', '並列実行数', '10')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.url);
    
    // 認証チェック
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ 認証が必要です。"aireer login"でログインしてください。'));
      process.exit(1);
    }

    console.log(chalk.blue('⚡ 並列実行モードを開始します...'));
    console.log(chalk.gray(`ベースURL: ${options.url}`));
    console.log(chalk.gray(`エンドポイント: ${options.endpoints}`));
    console.log(chalk.gray(`実行回数: ${options.count}`));
    console.log(chalk.gray(`並列実行数: ${options.threads}`));
    
    const endpoints = options.endpoints.split(',').map((ep: string) => ep.trim());
    await runParallelRequests({
      baseUrl: options.url,
      endpoints,
      count: parseInt(options.count),
      concurrent: parseInt(options.threads),
      authManager
    });
  });

program
  .command('interactive')
  .alias('i')
  .description('インタラクティブモードで設定')
  .action(async () => {
    displayCompactLogo();
    console.log(chalk.blue('🎯 インタラクティブモードを開始します...'));
    await setupInteractiveMode();
  });

program
  .command('health')
  .description('APIの健康状態をチェック')
  .option('-u, --url <url>', 'APIのベースURL', 'https://api.aireer.work')
  .action(async (options: any) => {
    const { checkApiHealth } = await import('./health.js');
    await checkApiHealth(options.url);
  });

// デフォルトでhelpを表示
if (process.argv.length <= 2) {
  displayLogo();
  program.help();
}

program.parse(process.argv); 