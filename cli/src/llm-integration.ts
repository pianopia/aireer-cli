import chalk from 'chalk';
import ora from 'ora';
import { FileManager } from './file-manager.js';
import { ApiClient } from './api-client.js';
import { execSync } from 'child_process';
import * as path from 'path';

interface LLMResponse {
  type: 'create' | 'change' | 'delete' | 'execute' | 'done';
  filepath?: string;
  file?: string;
  command?: string;
  directory?: string;
}

interface LLMOptions {
  apiUrl?: string;
  apiEndpoint?: string;
  directory: string;
  interval: number;
}

export async function setupLLMMode(initialPrompt: string = '', options: LLMOptions): Promise<void> {
  console.log(chalk.blue('🤖 LLM API連携モードを開始します...'));
  console.log(chalk.gray(`API URL: ${options.apiUrl || 'http://localhost:3000'}`));
  console.log(chalk.gray(`作業ディレクトリ: ${options.directory}`));
  console.log(chalk.gray(`チェック間隔: ${options.interval}秒\n`));

  const fileManager = new FileManager(options.directory);
  const apiClient = new ApiClient(options.apiUrl || 'http://localhost:3000');
  let previousResponseJson: LLMResponse | null = null;

  // 初期プロンプトの設定
  const basePrompt = buildBasePrompt(initialPrompt);
  console.log(chalk.cyan('📝 初期プロンプト:'));
  console.log(chalk.gray(basePrompt.substring(0, 200) + '...'));

  // Ctrl+Cで停止するためのハンドラー
  let isRunning = true;
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⏹️  LLM API連携モードを停止しています...'));
    isRunning = false;
    process.exit(0);
  });

  while (isRunning) {
    try {
      // 現在のディレクトリ状態を取得
      const currentState = await getDirectoryState(options.directory);
      const prompt = `${basePrompt}\n現在のディレクトリの状態: ${currentState}`;

      console.log(chalk.blue('\n🔄 LLM APIに問い合わせ中...'));
      
      // APIを通してLLMからレスポンスを取得
      const response = await getLLMResponseFromAPI(apiClient, prompt, options.apiEndpoint);
      
      if (!response) {
        console.log(chalk.yellow('⚠️  APIからレスポンスが得られませんでした'));
        await sleep(options.interval * 1000);
        continue;
      }

      console.log(chalk.green('📨 API レスポンス:'));
      console.log(response);

      // JSONを解析
      const responseJson = parseJSONResponse(response);
      
      if (!responseJson) {
        console.log(chalk.yellow('⚠️  有効なJSONレスポンスが得られませんでした'));
        await sleep(options.interval * 1000);
        continue;
      }

      // 前回のレスポンスと同じかチェック
      if (previousResponseJson && JSON.stringify(responseJson) === JSON.stringify(previousResponseJson)) {
        if (responseJson.filepath && responseJson.type !== 'done') {
          // ファイルが存在するかチェックして目的達成を確認
          const fileInfo = fileManager.getFileInfo(responseJson.filepath);
          if (fileInfo.exists) {
            console.log(chalk.green('✅ 目的が達成されているようです。完了処理を実行します。'));
            break;
          }
        }
      }

      previousResponseJson = responseJson;

      // JSONレスポンスに基づいてファイル操作を実行
      await executeFileOperation(responseJson, fileManager, options.directory);

      // 完了チェック
      if (responseJson.type === 'done') {
        console.log(chalk.green('🎉 完了しました。ループを終了します。'));
        break;
      }

      // 次の実行まで待機
      if (isRunning) {
        console.log(chalk.gray(`⏳ ${options.interval}秒待機中...`));
        await sleep(options.interval * 1000);
      }

    } catch (error) {
      console.error(chalk.red('❌ エラーが発生しました:'), error);
      if (isRunning) {
        console.log(chalk.gray(`⏳ ${options.interval}秒待機してリトライします...`));
        await sleep(options.interval * 1000);
      }
    }
  }
}

function buildBasePrompt(initialPrompt: string): string {
  const basePrompt = `${initialPrompt}
responseは下記のjson型で返却してください。メッセージなどは要らず全てjsonのみで返却してください。json以外のメッセージは返却しないでください。必要な場合にはコマンドを実行するためのjsonを返してください。jsonは改行せず一行にしてください。

{"type": "create", "filepath": "<対象ファイルのフルパス>", "file": "<ファイルの実装中身>", "command": "<実行するコマンド>"}

- ファイルを作成する必要があるときはtypeは"create"にして
- 削除するときはtypeは"delete"
- 変更するときや修正するときはtypeは"change"にして  
- プロジェクトを作成したりコマンドを実行するときはtypeは"execute"にして
- 目標を達成していたりすでに対象のファイルが存在していて条件を満たしていたらtypeは"done"にして

画面デザインをソースコードで作るときは必ずモダンかつおしゃれでアイコンを多めに使うようにしてください。
前回と同じjsonが返却されている場合、対象のファイルをチェックして変更がなければdoneを返却するようにしてください。`;

  return basePrompt;
}

async function getDirectoryState(directory: string): Promise<string> {
  try {
    // 'tree'コマンドを実行してディレクトリの状態を取得
    const result = execSync(`tree -I "node_modules|test.py|*.log|dist" -L 3 "${directory}"`, { 
      encoding: 'utf-8',
      cwd: directory 
    });
    return result;
  } catch (error) {
    // tree コマンドが使用できない場合はlsを使用
    try {
      const result = execSync(`find "${directory}" -maxdepth 3 -type f | head -20`, { 
        encoding: 'utf-8',
        cwd: directory 
      });
      return result;
    } catch (error2) {
      console.error(chalk.red('ディレクトリ状態の取得に失敗しました:'), error2);
      return '';
    }
  }
}

async function getLLMResponseFromAPI(
  apiClient: ApiClient, 
  prompt: string, 
  endpoint: string = '/api/llm/generate'
): Promise<string | null> {
  try {
    const requestData = {
      prompt: prompt,
      timestamp: new Date().toISOString()
    };

    const response = await apiClient.post(endpoint, requestData);
    
    // APIレスポンスからLLMの結果を抽出
    if (response.success && response.data) {
      return response.data.llmResponse || response.data.response || response.data;
    } else if (typeof response === 'string') {
      return response;
    }
    
    return null;
  } catch (error) {
    console.error(chalk.red('LLM API呼び出しエラー:'), error);
    return null;
  }
}

function parseJSONResponse(response: string): LLMResponse | null {
  try {
    // レスポンス全体がJSONの場合
    if (response.trim().startsWith('{') && response.trim().endsWith('}')) {
      return JSON.parse(response.trim()) as LLMResponse;
    }
    
    // レスポンスから最初に見つかるJSONを抽出
    const lines = response.trim().split('\n');
    const jsonLine = lines.find(line => line.trim().startsWith('{'));
    
    if (!jsonLine) {
      // JSON開始の{を探す
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonStr = response.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonStr) as LLMResponse;
      }
      
      return null;
    }
    
    return JSON.parse(jsonLine.trim()) as LLMResponse;
  } catch (error) {
    console.error(chalk.red('JSONパースエラー:'), error);
    console.log(chalk.gray('パース対象の文字列:'), response);
    return null;
  }
}

async function executeFileOperation(
  responseJson: LLMResponse, 
  fileManager: FileManager, 
  baseDirectory: string
): Promise<void> {
  const { type, filepath, file, command, directory } = responseJson;

  console.log(chalk.blue(`🔧 操作実行: ${type} ${filepath || command || ''}`));

  // ディレクトリ移動が必要な場合
  if (directory && directory !== '.') {
    const targetDir = path.resolve(baseDirectory, directory);
    try {
      process.chdir(targetDir);
      console.log(chalk.blue(`📁 ディレクトリを変更: ${directory}`));
    } catch (error) {
      console.error(chalk.red(`ディレクトリ変更に失敗: ${directory}`));
    }
  }

  switch (type) {
    case 'create':
      if (filepath && file !== undefined) {
        await fileManager.createFile(filepath, file);
      } else {
        console.log(chalk.red('❌ create操作にはfilepathとfileが必要です'));
      }
      break;

    case 'change':
      if (filepath && file !== undefined) {
        await fileManager.editFile(filepath, file);
      } else {
        console.log(chalk.red('❌ change操作にはfilepathとfileが必要です'));
      }
      break;

    case 'delete':
      if (filepath) {
        await fileManager.deleteFile(filepath);
      } else {
        console.log(chalk.red('❌ delete操作にはfilepathが必要です'));
      }
      break;

    case 'execute':
      if (command) {
        const spinner = ora(`コマンドを実行中: ${command}`).start();
        try {
          const result = execSync(command, { 
            encoding: 'utf-8',
            cwd: process.cwd(),
            stdio: 'pipe'
          });
          spinner.succeed(chalk.green(`コマンドを実行しました: ${command}`));
          if (result.trim()) {
            console.log(chalk.gray('実行結果:'));
            console.log(result);
          }
        } catch (error) {
          spinner.fail(chalk.red(`コマンド実行に失敗しました: ${command}`));
          console.error(error);
        }
      } else {
        console.log(chalk.red('❌ execute操作にはcommandが必要です'));
      }
      break;

    case 'done':
      console.log(chalk.green('✅ 完了処理が指示されました'));
      break;

    default:
      console.log(chalk.yellow(`⚠️  不明な操作タイプ: ${type}`));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 