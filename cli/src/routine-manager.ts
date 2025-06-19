import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from './api-client.js';
import { AuthManager } from './auth-manager.js';

interface Routine {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  steps: RoutineStep[];
}

interface RoutineStep {
  id: string;
  routineId: string;
  order: number;
  type: string;
  content: string;
  parameters?: any;
}

interface RoutinePriority {
  routineId: string;
  priority: number; // 1-10 (10が最高)
  weight: number;   // 実行確率の重み
  lastExecuted?: string;
  executionCount: number;
  successRate: number;
}

interface RoutineConfig {
  priorities: RoutinePriority[];
  globalSettings: {
    maxExecutionsPerCycle: number;
    cooldownPeriod: number; // 秒
    minimumInterval: number; // 秒
  };
}

export class RoutineManager {
  private configFile: string;
  private apiClient: ApiClient;
  private config: RoutineConfig;
  private authManager?: AuthManager;

  constructor(apiUrl: string, configDirectory: string = '.', authManager?: AuthManager) {
    this.apiClient = new ApiClient(apiUrl);
    this.authManager = authManager;
    
    // 認証トークンを設定
    if (authManager) {
      const token = authManager.getConfigManager().getToken();
      if (token) {
        this.apiClient.setAuthToken(token);
      }
    }
    
    this.configFile = path.join(configDirectory, '.aireer-priorities.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): RoutineConfig {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  設定ファイルの読み込みに失敗しました。デフォルト設定を使用します。'));
    }

    // デフォルト設定
    return {
      priorities: [],
      globalSettings: {
        maxExecutionsPerCycle: 3,
        cooldownPeriod: 300, // 5分
        minimumInterval: 60   // 1分
      }
    };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ 設定ファイルの保存に失敗しました:'), error);
    }
  }

  async fetchActiveRoutines(): Promise<Routine[]> {
    try {
      const response = await this.apiClient.get('/api/routines?active=true');
      if (response.success && response.data) {
        return response.data;
      }
      // API レスポンスが正常でも data が空の場合
      console.log(chalk.gray('📝 アクティブなルーチンがありません'));
      return [];
    } catch (error) {
      // HTTP 500 エラーでも、認証関連エラーかルーチンなしかを判断
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          console.error(chalk.red('❌ 認証エラー: ログインが必要です'));
        } else if (error.message.includes('500')) {
          // HTTP 500の場合、ルーチンがないことが原因の可能性が高い
          console.log(chalk.gray('📝 アクティブなルーチンがありません (サーバーにルーチンが存在しません)'));
        } else {
          console.log(chalk.yellow('⚠️  ルーチン取得で軽微なエラーが発生しましたが、処理を続行します'));
        }
      }
      return [];
    }
  }

  updateRoutinePriorities(routines: Routine[]): void {
    console.log(chalk.blue('🔄 ルーチン優先度を更新中...'));
    
    // 新しいルーチンがあれば追加
    for (const routine of routines) {
      const existing = this.config.priorities.find(p => p.routineId === routine.id);
      if (!existing) {
        const newPriority: RoutinePriority = {
          routineId: routine.id,
          priority: 5, // デフォルト中間優先度
          weight: 1.0,
          executionCount: 0,
          successRate: 1.0
        };
        this.config.priorities.push(newPriority);
        console.log(chalk.green(`➕ 新しいルーチンを追加: ${routine.name} (優先度: ${newPriority.priority})`));
      }
    }

    // 存在しないルーチンを削除
    const activeRoutineIds = routines.map(r => r.id);
    this.config.priorities = this.config.priorities.filter(p => {
      if (activeRoutineIds.includes(p.routineId)) {
        return true;
      } else {
        const routine = routines.find(r => r.id === p.routineId);
        console.log(chalk.gray(`🗑️  非アクティブなルーチンを削除: ${routine?.name || p.routineId}`));
        return false;
      }
    });

    this.saveConfig();
  }

  selectRoutineToExecute(routines: Routine[]): Routine | null {
    if (routines.length === 0) {
      return null;
    }

    const now = new Date();
    const currentTime = now.getTime();

    // クールダウン中のルーチンを除外
    const availableRoutines = routines.filter(routine => {
      const priority = this.config.priorities.find(p => p.routineId === routine.id);
      if (!priority || !priority.lastExecuted) {
        return true;
      }

      const lastExecuted = new Date(priority.lastExecuted).getTime();
      const cooldownMs = this.config.globalSettings.cooldownPeriod * 1000;
      return (currentTime - lastExecuted) > cooldownMs;
    });

    if (availableRoutines.length === 0) {
      console.log(chalk.yellow('⏸️  すべてのルーチンがクールダウン中です'));
      return null;
    }

    // 重み付き確率選択
    const weights = availableRoutines.map(routine => {
      const priority = this.config.priorities.find(p => p.routineId === routine.id);
      if (!priority) return 1;

      // 優先度、成功率、前回実行からの時間を考慮した重み計算
      let weight = priority.priority * priority.weight * priority.successRate;
      
      // 前回実行からの時間が長いほど重みを増加
      if (priority.lastExecuted) {
        const timeSinceLastExecution = currentTime - new Date(priority.lastExecuted).getTime();
        const hoursSince = timeSinceLastExecution / (1000 * 60 * 60);
        weight *= Math.min(1 + hoursSince * 0.1, 3); // 最大3倍まで
      }

      return Math.max(weight, 0.1); // 最低重み
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    for (let i = 0; i < availableRoutines.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        const selectedRoutine = availableRoutines[i];
        console.log(chalk.green(`🎯 ルーチンを選択: ${selectedRoutine.name} (重み: ${weights[i].toFixed(2)})`));
        return selectedRoutine;
      }
    }

    // フォールバック（最後のルーチン）
    return availableRoutines[availableRoutines.length - 1];
  }

  recordExecution(routineId: string, success: boolean): void {
    const priority = this.config.priorities.find(p => p.routineId === routineId);
    if (priority) {
      priority.lastExecuted = new Date().toISOString();
      priority.executionCount++;
      
      // 成功率を更新（指数移動平均）
      const alpha = 0.2; // 学習率
      priority.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * priority.successRate;
      
      this.saveConfig();
    }
  }

  async getRoutinePriorityInfo(): Promise<void> {
    console.log(chalk.blue('\n📊 現在のルーチン優先度設定:'));

    // 最新のルーチン情報を取得
    const routines = await this.fetchActiveRoutines();
    const routineMap = new Map(routines.map(r => [r.id, r]));

    for (const priority of this.config.priorities) {
      const routine = routineMap.get(priority.routineId);
      const lastExecuted = priority.lastExecuted ? 
        new Date(priority.lastExecuted).toLocaleString('ja-JP') : 
        '未実行';
      
      // ルーチンの基本情報
      const routineName = routine?.name || '不明';
      const description = routine?.description || '説明なし';
      
      // 最初のステップの内容をプロンプトとして取得
      let firstStepContent = 'ステップなし';
      if (routine?.steps && routine.steps.length > 0) {
        const firstStep = routine.steps.sort((a, b) => a.order - b.order)[0];
        firstStepContent = firstStep.content || 'ステップ内容なし';
      }

      // 各ルーチンを見やすく表示
      console.log(chalk.cyan(`\n📋 ${routineName} (ID: ${priority.routineId.substring(0, 10)})`));
      console.log(chalk.gray(`   優先度: ${priority.priority}/10  |  重み: ${priority.weight.toFixed(2)}  |  実行: ${priority.executionCount}回  |  成功率: ${(priority.successRate * 100).toFixed(1)}%`));
      console.log(chalk.gray(`   最終実行: ${lastExecuted}`));
      console.log(chalk.yellow(`   📝 説明: ${description}`));
      console.log(chalk.green(`   🔧 プロンプト: ${firstStepContent.length > 80 ? firstStepContent.substring(0, 80) + '...' : firstStepContent}`));
    }

    console.log(chalk.blue('\n⚙️  グローバル設定:'));
    console.log(chalk.gray(`最大実行数/サイクル: ${this.config.globalSettings.maxExecutionsPerCycle}`));
    console.log(chalk.gray(`クールダウン期間: ${this.config.globalSettings.cooldownPeriod}秒`));
    console.log(chalk.gray(`最小実行間隔: ${this.config.globalSettings.minimumInterval}秒`));
  }

  adjustPriority(routineId: string, newPriority: number): boolean {
    const priority = this.config.priorities.find(p => p.routineId === routineId);
    if (priority) {
      priority.priority = Math.max(1, Math.min(10, newPriority));
      this.saveConfig();
      console.log(chalk.green(`✅ ルーチン ${routineId} の優先度を ${priority.priority} に設定しました`));
      return true;
    }
    console.log(chalk.red(`❌ ルーチン ${routineId} が見つかりません`));
    return false;
  }

  adjustWeight(routineId: string, newWeight: number): boolean {
    const priority = this.config.priorities.find(p => p.routineId === routineId);
    if (priority) {
      priority.weight = Math.max(0.1, Math.min(5.0, newWeight));
      this.saveConfig();
      console.log(chalk.green(`✅ ルーチン ${routineId} の重みを ${priority.weight} に設定しました`));
      return true;
    }
    console.log(chalk.red(`❌ ルーチン ${routineId} が見つかりません`));
    return false;
  }
} 