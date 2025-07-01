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
  console.log(chalk.blue('🤖 Starting fully autonomous mode...'));
  console.log(chalk.gray(`API URL: ${options.apiUrl}`));
  console.log(chalk.gray(`Working directory: ${options.directory}`));
  console.log(chalk.gray(`Execution interval: ${options.interval} seconds`));
  console.log(chalk.gray(`Max executions/cycle: ${options.maxExecutionsPerCycle}`));
  console.log(chalk.gray(`LLM mode: ${options.useGeminiDirect ? 'Gemini Direct' : 'Via API'}\n`));

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

  // Handler to stop with Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⏹️  Stopping autonomous mode...'));
    isRunning = false;
    process.exit(0);
  });

  // Display initial priority settings
  console.log(chalk.blue('📋 Checking initial settings...'));
  await updateRoutinePriorities(routineManager);

  while (isRunning) {
    cycleCount++;
    console.log(chalk.cyan(`\n🔄 Starting cycle ${cycleCount}...`));

    try {
      // Fetch active routines
      const activeRoutines = await routineManager.fetchActiveRoutines();
      
      if (activeRoutines.length === 0) {
        if (cycleCount === 1) {
          console.log(chalk.blue('📝 No active routines are currently configured'));
          console.log(chalk.gray('   Create and activate routines to start automatic execution'));
        } else {
          console.log(chalk.gray('📝 No active routines available'));
        }
        await sleep(options.interval * 1000);
        continue;
      }

      console.log(chalk.blue(`📥 Retrieved ${activeRoutines.length} active routines`));

      // Update priority settings
      routineManager.updateRoutinePriorities(activeRoutines);

      // Select routines to execute in this cycle
      const executionsThisCycle = [];
      
      for (let i = 0; i < options.maxExecutionsPerCycle; i++) {
        const selectedRoutine = routineManager.selectRoutineToExecute(activeRoutines);
        
        if (!selectedRoutine) {
          console.log(chalk.yellow(`⏸️  No executable routines available (${i + 1}/${options.maxExecutionsPerCycle})`));
          break;
        }

        executionsThisCycle.push(selectedRoutine);
        
        // Temporarily mark as executed to prevent duplicate execution in the same cycle
        routineManager.recordExecution(selectedRoutine.id, true);
      }

      // Execute selected routines in parallel
      if (executionsThisCycle.length > 0) {
        console.log(chalk.green(`🚀 Executing ${executionsThisCycle.length} routines...`));
        
        const executionPromises = executionsThisCycle.map(routine => 
          executeRoutine(routine, apiClient, fileManager, options, routineManager, logManager, executionHistory, cycleCount)
        );

        await Promise.allSettled(executionPromises);
      } else {
        console.log(chalk.yellow('😴 No routines to execute in this cycle'));
      }

      // Display statistics
      if (cycleCount % 5 === 0) {
        await routineManager.getRoutinePriorityInfo();
      }

      // Reset rate limit error count (successful cycle)
      rateLimitErrorCount = 0;
      adaptiveInterval = options.interval;

      // Wait until next cycle
      if (isRunning) {
        console.log(chalk.gray(`⏳ Waiting ${adaptiveInterval} seconds...`));
        await sleep(adaptiveInterval * 1000);
      }

    } catch (error: any) {
      // Special handling for rate limit errors
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

             // Record error with LogManager
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
         error.response?.data // Record API error response if available
       );
      
      if (isRunning) {
        console.log(chalk.gray(`⏳ Waiting ${adaptiveInterval} seconds before retry...`));
        await sleep(adaptiveInterval * 1000);
      }
    }
  }
}

async function updateRoutinePriorities(routineManager: RoutineManager): Promise<void> {
  const spinner = ora('Updating routine priorities...').start();
  
  try {
    const routines = await routineManager.fetchActiveRoutines();
    if (routines.length === 0) {
      spinner.info('No active routines found - skipping priority settings');
      return;
    }
    
    routineManager.updateRoutinePriorities(routines);
    await routineManager.getRoutinePriorityInfo();
    spinner.succeed('Routine priority update complete');
  } catch (error) {
    spinner.fail('Failed to update routine priorities');
    console.log(chalk.gray('   Continuing with execution...'));
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
    console.log(chalk.blue(`\n🔧 Starting routine execution: ${routine.name}`));
    console.log(chalk.gray(`Description: ${routine.description}`));

    // Build routine content as prompt
    const prompt = await buildRoutinePrompt(routine, executionHistory);
    
    // Get current directory state
    const currentState = await getDirectoryState(options.directory);
    const fullPrompt = `${prompt}\n\nCurrent directory state:\n${currentState}`;
    executedPrompt = fullPrompt;

    console.log(chalk.cyan('📤 Sending request to LLM API...'));

    // Call LLM API (Gemini direct or via API)
    let llmResult: { content: string | null; rawResponse: any };
    
    if (options.useGeminiDirect && options.geminiClient) {
      // Direct request to Gemini API
      const geminiResult = await RateLimitHandler.executeWithRetry(
        () => options.geminiClient!.generateContent({ prompt: fullPrompt }),
        { maxRetries: 2, baseDelay: 2000 }
      );
      llmResult = {
        content: geminiResult.content,
        rawResponse: geminiResult.rawResponse
      };
    } else {
      // Request via API
      llmResult = await RateLimitHandler.executeWithRetry(
        () => getLLMResponseFromAPI(apiClient, fullPrompt, options.llmEndpoint),
        { maxRetries: 2, baseDelay: 2000 }
      );
    }
    
    if (!llmResult?.content) {
      throw new Error('No response received from LLM API');
    }

    // Parse and execute JSON response
    const responseJson = parseJSONResponse(llmResult.content);
    llmResponseData = responseJson;
    
    if (responseJson) {
              await executeFileOperation(responseJson, fileManager, options.directory);
        // Record file operations
        fileOperations.push({
          type: responseJson.type,
          filepath: responseJson.filepath,
          command: responseJson.command,
          success: true
        });
      success = true;
      console.log(chalk.green(`✅ Routine "${routine.name}" execution completed`));
      
      // Record success log (including API response)
      logManager.logSuccess(`routine-${routine.id}`, {
        routineName: routine.name,
        responseType: responseJson.type,
        duration: Date.now() - startTime,
        llmResponse: responseJson
      }, llmResult.rawResponse);
    } else {
      throw new Error('No valid JSON response received');
    }

  } catch (error: any) {
    // Determine error type
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

    // Record error with LogManager (details in file, concise in CLI)
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
      error.response?.data // Record API error response if available
    );

    success = false;
  } finally {
    // Record execution result
    const duration = Date.now() - startTime;
    routineManager.recordExecution(routine.id, success);

    // Record detailed execution history
    const executionDetail: ExecutionDetail = {
      id: nanoid(),
      routineId: routine.id,
      routineName: routine.name,
      success,
      message: success ? 'Executed successfully' : errorMessage || 'Error occurred during execution',
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

    // Record detailed history using ExecutionHistory class
    await executionHistory.recordExecution(executionDetail);
  }
}

async function buildRoutinePrompt(routine: any, executionHistory: ExecutionHistory): Promise<string> {
  let prompt = `Routine: ${routine.name}\nDescription: ${routine.description}\n\n`;
  
  if (routine.steps && routine.steps.length > 0) {
    prompt += 'Steps:\n';
    routine.steps.forEach((step: any, index: number) => {
      prompt += `${index + 1}. ${step.content}`;
      if (step.parameters) {
        try {
          const params = typeof step.parameters === 'string' ? 
            JSON.parse(step.parameters) : step.parameters;
          prompt += ` (Parameters: ${JSON.stringify(params)})`;
        } catch (e) {
          // Ignore parameter parsing errors
        }
      }
      prompt += '\n';
    });
  }

  // Add previous execution history (to avoid duplication)
  const previousExecutionsSummary = await executionHistory.getPreviousExecutionsSummary(routine.id, 3);
  prompt += `\n${previousExecutionsSummary}\n`;

  // Get recent file operations list
  const recentOperations = await executionHistory.getRecentFileOperations(routine.id, 24);
  if (recentOperations.length > 0) {
    prompt += `【Operations executed within the last 24 hours (avoid duplication)】\n`;
    recentOperations.forEach(op => {
      prompt += `- ${op}\n`;
    });
    prompt += `Please avoid the same files/commands as above operations and take a new approach.\n\n`;
  }

  prompt += `Please return the execution content in the following JSON format. No messages needed, return only JSON:
{"type": "create|change|delete|execute|done", "filepath": "<file path>", "file": "<file content>", "command": "<command>"}

- To create a file: type="create"
- To modify a file: type="change"  
- To delete a file: type="delete"
- To execute a command: type="execute"
- To do nothing: type="done"

【Important Instructions】
1. Avoid exactly the same operations as previous execution history
2. Do not recreate files that have already been created  
3. Do not repeatedly execute the same commands
4. Proceed with tasks from new perspectives or different approaches
5. Check if existing files exist and select change if necessary`;

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
      return 'Failed to get directory state';
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
    console.error(chalk.red('LLM API call error:'), error);
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
    console.error(chalk.yellow('⚠️  JSON parsing error:'), error);
    return null;
  }
}

/**
 * 危険なコマンドをチェックして実行をブロックする
 */
function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const dangerousCommands = [
    'rm -rf /',
    'format',
    'shutdown',
    'reboot',
    'halt',
    'init 0',
    'init 6',
    'dd if=',
    'mkfs',
    'fdisk',
    'parted',
    'sudo rm',
    'sudo shutdown',
    'sudo reboot',
    'sudo halt'
  ];

  const dangerousPaths = [
    '/etc/',
    '/usr/',
    '/bin/',
    '/sbin/',
    '/boot/',
    '/sys/',
    '/proc/',
    '/dev/'
  ];

  const lowerCommand = command.toLowerCase().trim();
  
  // 危険なコマンドのチェック
  for (const dangerous of dangerousCommands) {
    if (lowerCommand.includes(dangerous)) {
      return { safe: false, reason: `危険なコマンドが検出されました: ${dangerous}` };
    }
  }

  // 危険なパスへの操作チェック
  for (const path of dangerousPaths) {
    if (lowerCommand.includes(path)) {
      return { safe: false, reason: `システム重要ディレクトリへの操作は禁止されています: ${path}` };
    }
  }

  // sudo権限の使用チェック
  if (lowerCommand.startsWith('sudo ') && !lowerCommand.includes('npm') && !lowerCommand.includes('yarn')) {
    return { safe: false, reason: '管理者権限が必要なコマンドは制限されています' };
  }

  return { safe: true };
}

/**
 * パスがワーキングディレクトリ内に制限されているかチェック
 */
function isPathSafe(filepath: string, baseDirectory: string): { safe: boolean; reason?: string } {
  const path = require('path');
  
  try {
    const resolvedPath = path.resolve(baseDirectory, filepath);
    const resolvedBase = path.resolve(baseDirectory);
    
    if (!resolvedPath.startsWith(resolvedBase)) {
      return { safe: false, reason: 'ワーキングディレクトリ外への操作は禁止されています' };
    }
    
    return { safe: true };
  } catch (error) {
    return { safe: false, reason: 'パスの検証中にエラーが発生しました' };
  }
}

async function executeFileOperation(
  responseJson: LLMResponse, 
  fileManager: FileManager, 
  baseDirectory: string
): Promise<void> {
  console.log(chalk.blue(`🔧 Executing operation: ${responseJson.type}`));

  // ファイル操作のパス安全性チェック
  if (responseJson.filepath && !isPathSafe(responseJson.filepath, baseDirectory).safe) {
    const { reason } = isPathSafe(responseJson.filepath, baseDirectory);
    console.log(chalk.red(`🚫 セキュリティ制限: ${reason}`));
    return;
  }

  switch (responseJson.type) {
    case 'create':
      if (responseJson.filepath && responseJson.file) {
        try {
          await fileManager.createFile(responseJson.filepath, responseJson.file);
          console.log(chalk.green(`📄 File created: ${responseJson.filepath}`));
        } catch (error: any) {
          console.log(chalk.red(`❌ File creation failed: ${error.message}`));
        }
      }
      break;

    case 'change':
      if (responseJson.filepath && responseJson.file) {
        try {
          await fileManager.editFile(responseJson.filepath, responseJson.file);
          console.log(chalk.green(`📝 File updated: ${responseJson.filepath}`));
        } catch (error: any) {
          console.log(chalk.red(`❌ File update failed: ${error.message}`));
        }
      }
      break;

    case 'delete':
      if (responseJson.filepath) {
        try {
          await fileManager.deleteFile(responseJson.filepath);
          console.log(chalk.green(`🗑️  File deleted: ${responseJson.filepath}`));
        } catch (error: any) {
          console.log(chalk.red(`❌ File deletion failed: ${error.message}`));
        }
      }
      break;

    case 'execute':
      if (responseJson.command) {
        // コマンドの安全性チェック
        const { safe, reason } = isCommandSafe(responseJson.command);
        if (!safe) {
          console.log(chalk.red(`🚫 コマンド実行をブロックしました: ${reason}`));
          return;
        }

        try {
          console.log(chalk.cyan(`⚡ Executing command: ${responseJson.command}`));
          const result = execSync(responseJson.command, { 
            encoding: 'utf-8',
            cwd: responseJson.directory || baseDirectory,
            timeout: 30000 // 30 second timeout
          });
          console.log(chalk.gray(`Result: ${result.substring(0, 200)}...`));
        } catch (error: any) {
          console.log(chalk.red(`❌ Command execution failed: ${error.message}`));
        }
      }
      break;

    case 'done':
      console.log(chalk.green('✅ Processing completed'));
      break;

    default:
      console.log(chalk.yellow(`⚠️  Unknown operation type: ${responseJson.type}`));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 