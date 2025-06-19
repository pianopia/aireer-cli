import chalk from 'chalk';
import ora from 'ora';
import { RoutineManager } from './routine-manager.js';
import { ApiClient } from './api-client.js';
import { FileManager } from './file-manager.js';
import { RateLimitHandler } from './rate-limit-handler.js';
import { LogManager } from './log-manager.js';
import { AuthManager } from './auth-manager.js';
import { ExecutionHistory, ExecutionDetail, FileOperation } from './execution-history.js';
import { GeminiClient, GeminiRequest } from './gemini-client.js';
import { execSync } from 'child_process';
import { nanoid } from 'nanoid';

interface AutonomousOptions {
  apiUrl: string;
  directory: string;
  interval: number;
  llmEndpoint: string;
  maxExecutionsPerCycle: number;
  authManager: AuthManager;
  useGeminiDirect?: boolean;
  geminiClient?: GeminiClient;
}

interface LLMResponse {
  type: 'create' | 'change' | 'delete' | 'execute' | 'done';
  filepath?: string;
  file?: string;
  command?: string;
  directory?: string;
}

export async function startAutonomousMode(options: AutonomousOptions): Promise<void> {
  console.log(chalk.blue('🤖 完全自律モードを開始します...'));
  console.log(chalk.gray(`API URL: ${options.apiUrl}`));
  console.log(chalk.gray(`作業ディレクトリ: ${options.directory}`));
  console.log(chalk.gray(`実行間隔: ${options.interval}秒`));
  console.log(chalk.gray(`最大実行数/サイクル: ${options.maxExecutionsPerCycle}`));
  console.log(chalk.gray(`LLMモード: ${options.useGeminiDirect ? 'Gemini Direct' : 'API経由'}\n`));

  const routineManager = new RoutineManager(options.apiUrl, options.directory, options.authManager);
  const apiClient = new ApiClient(options.apiUrl);
  
  // 認証トークンを設定
  const token = options.authManager.getConfigManager().getToken();
  if (token) {
    apiClient.setAuthToken(token);
  }
  
  const fileManager = new FileManager(options.directory);
  const logManager = new LogManager(options.directory);
  const executionHistory = new ExecutionHistory(apiClient, options.directory);

  let isRunning = true;
  let cycleCount = 0;
  let rateLimitErrorCount = 0;
  let adaptiveInterval = options.interval;

  // Ctrl+Cで停止するためのハンドラー
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⏹️  自律モードを停止しています...'));
    isRunning = false;
    process.exit(0);
  });

  // 初期の優先度設定を表示
  console.log(chalk.blue('📋 初期設定を確認中...'));
  await updateRoutinePriorities(routineManager);

  while (isRunning) {
    cycleCount++;
    console.log(chalk.cyan(`\n🔄 サイクル ${cycleCount} を開始...`));

    try {
      // アクティブなルーチンを取得
      const activeRoutines = await routineManager.fetchActiveRoutines();
      
      if (activeRoutines.length === 0) {
        if (cycleCount === 1) {
          console.log(chalk.blue('📝 現在、アクティブなルーチンが設定されていません'));
          console.log(chalk.gray('   ルーチンを作成してアクティブ化すると、自動実行が開始されます'));
        } else {
          console.log(chalk.gray('📝 アクティブなルーチンがありません'));
        }
        await sleep(options.interval * 1000);
        continue;
      }

      console.log(chalk.blue(`📥 ${activeRoutines.length}個のアクティブなルーチンを取得`));

      // 優先度設定を更新
      routineManager.updateRoutinePriorities(activeRoutines);

      // 今回のサイクルで実行するルーチンを選択
      const executionsThisCycle = [];
      
      for (let i = 0; i < options.maxExecutionsPerCycle; i++) {
        const selectedRoutine = routineManager.selectRoutineToExecute(activeRoutines);
        
        if (!selectedRoutine) {
          console.log(chalk.yellow(`⏸️  実行可能なルーチンがありません (${i + 1}/${options.maxExecutionsPerCycle})`));
          break;
        }

        executionsThisCycle.push(selectedRoutine);
        
        // 一時的に実行済みとマークして、同じサイクル内での重複実行を防ぐ
        routineManager.recordExecution(selectedRoutine.id, true);
      }

      // 選択されたルーチンを並列実行
      if (executionsThisCycle.length > 0) {
        console.log(chalk.green(`🚀 ${executionsThisCycle.length}個のルーチンを実行中...`));
        
        const executionPromises = executionsThisCycle.map(routine => 
          executeRoutine(routine, apiClient, fileManager, options, routineManager, logManager, executionHistory, cycleCount)
        );

        await Promise.allSettled(executionPromises);
      } else {
        console.log(chalk.yellow('😴 このサイクルでは実行するルーチンがありません'));
      }

      // 統計表示
      if (cycleCount % 5 === 0) {
        await routineManager.getRoutinePriorityInfo();
      }

      // レート制限エラーカウントをリセット（成功したサイクル）
      rateLimitErrorCount = 0;
      adaptiveInterval = options.interval;

      // 次のサイクルまで待機
      if (isRunning) {
        console.log(chalk.gray(`⏳ ${adaptiveInterval}秒待機中...`));
        await sleep(adaptiveInterval * 1000);
      }

    } catch (error: any) {
      // レート制限エラーの場合は特別な処理
      const isRateLimit = error.response?.data?.error === 'RATE_LIMIT_EXCEEDED' || 
                         error.status === 429 || 
                         error.message?.includes('rate limit');
      
      let errorType: any = 'UNKNOWN_ERROR';
      if (isRateLimit) {
        errorType = 'RATE_LIMIT_ERROR';
        rateLimitErrorCount++;
        RateLimitHandler.displayRateLimitInfo(error);
        adaptiveInterval = RateLimitHandler.suggestOptimalInterval(rateLimitErrorCount, adaptiveInterval);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        errorType = 'NETWORK_ERROR';
      } else if (error.message?.includes('routines') || error.message?.includes('API')) {
        errorType = 'LLM_API_ERROR';
      }

             // LogManagerでエラーを記録
       logManager.logError(
         `cycle-${cycleCount}`,
         error,
         errorType,
         {
           cycleCount,
           adaptiveInterval,
           rateLimitErrorCount,
           apiUrl: options.apiUrl,
           maxExecutions: options.maxExecutionsPerCycle
         },
         error.response?.data // APIエラーレスポンスがあれば記録
       );
      
      if (isRunning) {
        console.log(chalk.gray(`⏳ ${adaptiveInterval}秒待機してリトライします...`));
        await sleep(adaptiveInterval * 1000);
      }
    }
  }
}

async function updateRoutinePriorities(routineManager: RoutineManager): Promise<void> {
  const spinner = ora('ルーチン優先度を更新中...').start();
  
  try {
    const routines = await routineManager.fetchActiveRoutines();
    if (routines.length === 0) {
      spinner.info('アクティブなルーチンがありません - 優先度設定をスキップ');
      return;
    }
    
    routineManager.updateRoutinePriorities(routines);
    await routineManager.getRoutinePriorityInfo();
    spinner.succeed('ルーチン優先度の更新完了');
  } catch (error) {
    spinner.fail('ルーチン優先度の更新に失敗');
    console.log(chalk.gray('   処理を続行します...'));
  }
}

async function executeRoutine(
  routine: any,
  apiClient: ApiClient,
  fileManager: FileManager,
  options: AutonomousOptions,
  routineManager: RoutineManager,
  logManager: LogManager,
  executionHistory: ExecutionHistory,
  cycleCount: number
): Promise<void> {
  const startTime = Date.now();
  let success = false;
  let executedPrompt = '';
  let llmResponseData: any = null;
  let fileOperations: FileOperation[] = [];
  let errorMessage = '';

  try {
    console.log(chalk.blue(`\n🔧 ルーチン実行開始: ${routine.name}`));
    console.log(chalk.gray(`説明: ${routine.description}`));

    // ルーチンの内容をプロンプトとして構築
    const prompt = await buildRoutinePrompt(routine, executionHistory);
    
    // 現在のディレクトリ状態を取得
    const currentState = await getDirectoryState(options.directory);
    const fullPrompt = `${prompt}\n\n現在のディレクトリの状態:\n${currentState}`;
    executedPrompt = fullPrompt;

    console.log(chalk.cyan('📤 LLM APIにリクエスト中...'));

    // LLM APIを叩く（Gemini直接 or API経由）
    let llmResult: { content: string | null; rawResponse: any };
    
    if (options.useGeminiDirect && options.geminiClient) {
      // Gemini APIに直接リクエスト
      const geminiResult = await RateLimitHandler.executeWithRetry(
        () => options.geminiClient!.generateContent({ prompt: fullPrompt }),
        { maxRetries: 2, baseDelay: 2000 }
      );
      llmResult = {
        content: geminiResult.content,
        rawResponse: geminiResult.rawResponse
      };
    } else {
      // API経由でリクエスト
      llmResult = await RateLimitHandler.executeWithRetry(
        () => getLLMResponseFromAPI(apiClient, fullPrompt, options.llmEndpoint),
        { maxRetries: 2, baseDelay: 2000 }
      );
    }
    
    if (!llmResult?.content) {
      throw new Error('LLM APIからレスポンスが得られませんでした');
    }

    // JSONレスポンスを解析して実行
    const responseJson = parseJSONResponse(llmResult.content);
    llmResponseData = responseJson;
    
    if (responseJson) {
              await executeFileOperation(responseJson, fileManager, options.directory);
        // ファイル操作の記録
        fileOperations.push({
          type: responseJson.type,
          filepath: responseJson.filepath,
          command: responseJson.command,
          success: true
        });
      success = true;
      console.log(chalk.green(`✅ ルーチン「${routine.name}」の実行完了`));
      
      // 成功ログを記録（APIレスポンスも含む）
      logManager.logSuccess(`routine-${routine.id}`, {
        routineName: routine.name,
        responseType: responseJson.type,
        duration: Date.now() - startTime,
        llmResponse: responseJson
      }, llmResult.rawResponse);
    } else {
      throw new Error('有効なJSONレスポンスが得られませんでした');
    }

  } catch (error: any) {
    // エラータイプを判定
    let errorType: any = 'ROUTINE_EXECUTION_ERROR';
    
    if (error.response?.data?.error === 'RATE_LIMIT_EXCEEDED' || error.status === 429) {
      errorType = 'RATE_LIMIT_ERROR';
    } else if (error.message?.includes('LLM API') || error.message?.includes('generate')) {
      errorType = 'LLM_API_ERROR';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorType = 'NETWORK_ERROR';
    } else if (error.message?.includes('ファイル') || error.message?.includes('file')) {
      errorType = 'FILE_OPERATION_ERROR';
    }

    errorMessage = error.message || 'Unknown error';

    // LogManagerでエラーを記録（詳細はファイルに、CLIには簡潔に）
    const errorId = logManager.logError(
      `routine-${routine.id}`,
      error,
      errorType,
      {
        routineName: routine.name,
        routineDescription: routine.description,
        executionStep: 'routine_execution',
        apiUrl: options.apiUrl,
        directory: options.directory
      },
      error.response?.data // APIエラーレスポンスがあれば記録
    );

    success = false;
  } finally {
    // 実行結果を記録
    const duration = Date.now() - startTime;
    routineManager.recordExecution(routine.id, success);

    // 詳細な実行履歴を記録
    const executionDetail: ExecutionDetail = {
      id: nanoid(),
      routineId: routine.id,
      routineName: routine.name,
      success,
      message: success ? '正常に実行されました' : errorMessage || '実行中にエラーが発生しました',
      error: success ? undefined : errorMessage,
      duration,
      executedAt: new Date().toISOString(),
      llmPrompt: executedPrompt,
      llmResponse: llmResponseData,
      fileOperations: fileOperations,
      systemContext: {
        directory: options.directory,
        timestamp: new Date().toISOString(),
        cycleCount: cycleCount
      }
    };

    // ExecutionHistoryクラスを使用して詳細な履歴を記録
    await executionHistory.recordExecution(executionDetail);
  }
}

async function buildRoutinePrompt(routine: any, executionHistory: ExecutionHistory): Promise<string> {
  let prompt = `ルーチン: ${routine.name}\n説明: ${routine.description}\n\n`;
  
  if (routine.steps && routine.steps.length > 0) {
    prompt += 'ステップ:\n';
    routine.steps.forEach((step: any, index: number) => {
      prompt += `${index + 1}. ${step.content}`;
      if (step.parameters) {
        try {
          const params = typeof step.parameters === 'string' ? 
            JSON.parse(step.parameters) : step.parameters;
          prompt += ` (パラメータ: ${JSON.stringify(params)})`;
        } catch (e) {
          // パラメータの解析に失敗した場合は無視
        }
      }
      prompt += '\n';
    });
  }

  // 前回の実行履歴を追加（重複回避のため）
  const previousExecutionsSummary = await executionHistory.getPreviousExecutionsSummary(routine.id, 3);
  prompt += `\n${previousExecutionsSummary}\n`;

  // 最近のファイル操作リストを取得
  const recentOperations = await executionHistory.getRecentFileOperations(routine.id, 24);
  if (recentOperations.length > 0) {
    prompt += `【24時間以内に実行済みの操作（重複回避）】\n`;
    recentOperations.forEach(op => {
      prompt += `- ${op}\n`;
    });
    prompt += `上記の操作と同じファイル・コマンドは避けて、新しいアプローチを取ってください。\n\n`;
  }

  prompt += `以下のJSON形式で実行内容を返してください。メッセージは不要で、JSONのみを返してください：
{"type": "create|change|delete|execute|done", "filepath": "<ファイルパス>", "file": "<ファイル内容>", "command": "<コマンド>"}

- ファイルを作成する場合: type="create"
- ファイルを変更する場合: type="change"  
- ファイルを削除する場合: type="delete"
- コマンドを実行する場合: type="execute"
- 何もしない場合: type="done"

【重要な指示】
1. 前回の実行履歴と全く同じ操作は避けてください
2. 既に作成済みのファイルを再作成しないでください  
3. 同じコマンドを繰り返し実行しないでください
4. 新しい観点や異なる手法でタスクを進めてください
5. 既存のファイルがあるかチェックして、必要に応じて変更（change）を選択してください`;

  return prompt;
}

async function getDirectoryState(directory: string): Promise<string> {
  try {
    const result = execSync(`tree -I "node_modules|*.log|dist|.git" -L 2 "${directory}"`, { 
      encoding: 'utf-8',
      cwd: directory 
    });
    return result;
  } catch (error) {
    try {
      const result = execSync(`find "${directory}" -maxdepth 2 -type f | head -10`, { 
        encoding: 'utf-8',
        cwd: directory 
      });
      return result;
    } catch (error2) {
      return 'ディレクトリ状態の取得に失敗しました';
    }
  }
}

async function getLLMResponseFromAPI(
  apiClient: ApiClient, 
  prompt: string, 
  endpoint: string
): Promise<{ content: string | null; rawResponse: any }> {
  try {
    const requestData = {
      prompt: prompt,
      timestamp: new Date().toISOString()
    };

    const response = await apiClient.post(endpoint, requestData);
    
    let content = null;
    if (response.success && response.data) {
      content = response.data.llmResponse || response.data.response || response.data;
    } else if (typeof response === 'string') {
      content = response;
    }
    
    return {
      content,
      rawResponse: response
    };
  } catch (error) {
    console.error(chalk.red('LLM API呼び出しエラー:'), error);
    return {
      content: null,
      rawResponse: null
    };
  }
}

function parseJSONResponse(response: string): LLMResponse | null {
  try {
    if (response.trim().startsWith('{') && response.trim().endsWith('}')) {
      return JSON.parse(response.trim()) as LLMResponse;
    }
    
    const jsonStart = response.indexOf('{');
    const jsonEnd = response.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonStr = response.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr) as LLMResponse;
    }
    
    return null;
  } catch (error) {
    console.error(chalk.yellow('⚠️  JSON解析エラー:'), error);
    return null;
  }
}

async function executeFileOperation(
  responseJson: LLMResponse, 
  fileManager: FileManager, 
  baseDirectory: string
): Promise<void> {
  console.log(chalk.blue(`🔧 操作実行: ${responseJson.type}`));

  switch (responseJson.type) {
    case 'create':
      if (responseJson.filepath && responseJson.file) {
        try {
          await fileManager.createFile(responseJson.filepath, responseJson.file);
          console.log(chalk.green(`📄 ファイル作成: ${responseJson.filepath}`));
        } catch (error: any) {
          console.log(chalk.red(`❌ ファイル作成失敗: ${error.message}`));
        }
      }
      break;

    case 'change':
      if (responseJson.filepath && responseJson.file) {
        try {
          await fileManager.editFile(responseJson.filepath, responseJson.file);
          console.log(chalk.green(`📝 ファイル更新: ${responseJson.filepath}`));
        } catch (error: any) {
          console.log(chalk.red(`❌ ファイル更新失敗: ${error.message}`));
        }
      }
      break;

    case 'delete':
      if (responseJson.filepath) {
        try {
          await fileManager.deleteFile(responseJson.filepath);
          console.log(chalk.green(`🗑️  ファイル削除: ${responseJson.filepath}`));
        } catch (error: any) {
          console.log(chalk.red(`❌ ファイル削除失敗: ${error.message}`));
        }
      }
      break;

    case 'execute':
      if (responseJson.command) {
        try {
          console.log(chalk.cyan(`⚡ コマンド実行: ${responseJson.command}`));
          const result = execSync(responseJson.command, { 
            encoding: 'utf-8',
            cwd: responseJson.directory || baseDirectory,
            timeout: 30000 // 30秒タイムアウト
          });
          console.log(chalk.gray(`結果: ${result.substring(0, 200)}...`));
        } catch (error: any) {
          console.log(chalk.red(`❌ コマンド実行失敗: ${error.message}`));
        }
      }
      break;

    case 'done':
      console.log(chalk.green('✅ 処理完了'));
      break;

    default:
      console.log(chalk.yellow(`⚠️  不明な操作タイプ: ${responseJson.type}`));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 