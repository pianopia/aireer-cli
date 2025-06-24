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
      console.log(chalk.yellow('⚠️  Failed to load configuration file. Using default settings.'));
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
      console.error(chalk.red('❌ Failed to save configuration file:'), error);
    }
  }

  async fetchActiveRoutines(): Promise<Routine[]> {
    try {
      const response = await this.apiClient.get('/api/routines?active=true');
      if (response.success && response.data) {
        return response.data;
      }
      // Case when API response is successful but data is empty
      console.log(chalk.gray('📝 No active routines available'));
      return [];
    } catch (error) {
      // Determine whether HTTP 500 error is due to authentication or no routines
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          console.error(chalk.red('❌ Authentication error: Login required'));
        } else if (error.message.includes('500')) {
          // HTTP 500 may be caused by no routines existing
          console.log(chalk.gray('📝 No active routines available (no routines exist on server)'));
        } else {
          console.log(chalk.yellow('⚠️  Minor error occurred during routine retrieval, continuing with execution'));
        }
      }
      return [];
    }
  }

  updateRoutinePriorities(routines: Routine[]): void {
    console.log(chalk.blue('🔄 Updating routine priorities...'));
    
    // Add new routines if any
    for (const routine of routines) {
      const existing = this.config.priorities.find(p => p.routineId === routine.id);
      if (!existing) {
        const newPriority: RoutinePriority = {
          routineId: routine.id,
          priority: 5, // Default medium priority
          weight: 1.0,
          executionCount: 0,
          successRate: 1.0
        };
        this.config.priorities.push(newPriority);
        console.log(chalk.green(`➕ Added new routine: ${routine.name} (priority: ${newPriority.priority})`));
      }
    }

    // Remove non-existent routines
    const activeRoutineIds = routines.map(r => r.id);
    this.config.priorities = this.config.priorities.filter(p => {
      if (activeRoutineIds.includes(p.routineId)) {
        return true;
      } else {
        const routine = routines.find(r => r.id === p.routineId);
        console.log(chalk.gray(`🗑️  Removed inactive routine: ${routine?.name || p.routineId}`));
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
      console.log(chalk.yellow('⏸️  All routines are in cooldown'));
      return null;
    }

    // Weighted probability selection
    const weights = availableRoutines.map(routine => {
      const priority = this.config.priorities.find(p => p.routineId === routine.id);
      if (!priority) return 1;

      // Weight calculation considering priority, success rate, and time since last execution
      let weight = priority.priority * priority.weight * priority.successRate;
      
      // Increase weight as time since last execution grows
      if (priority.lastExecuted) {
        const timeSinceLastExecution = currentTime - new Date(priority.lastExecuted).getTime();
        const hoursSince = timeSinceLastExecution / (1000 * 60 * 60);
        weight *= Math.min(1 + hoursSince * 0.1, 3); // Maximum 3x
      }

      return Math.max(weight, 0.1); // Minimum weight
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    for (let i = 0; i < availableRoutines.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        const selectedRoutine = availableRoutines[i];
        console.log(chalk.green(`🎯 Selected routine: ${selectedRoutine.name} (weight: ${weights[i].toFixed(2)})`));
        return selectedRoutine;
      }
    }

    // Fallback (last routine)
    return availableRoutines[availableRoutines.length - 1];
  }

  recordExecution(routineId: string, success: boolean): void {
    const priority = this.config.priorities.find(p => p.routineId === routineId);
    if (priority) {
      priority.lastExecuted = new Date().toISOString();
      priority.executionCount++;
      
      // Update success rate (exponential moving average)
      const alpha = 0.2; // Learning rate
      priority.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * priority.successRate;
      
      this.saveConfig();
    }
  }

  async getRoutinePriorityInfo(): Promise<void> {
    console.log(chalk.blue('\n📊 Current routine priority settings:'));

    // Get latest routine information
    const routines = await this.fetchActiveRoutines();
    const routineMap = new Map(routines.map(r => [r.id, r]));

    for (const priority of this.config.priorities) {
      const routine = routineMap.get(priority.routineId);
      const lastExecuted = priority.lastExecuted ? 
        new Date(priority.lastExecuted).toLocaleString() : 
        'Never executed';
      
      // Basic routine information
      const routineName = routine?.name || 'Unknown';
      const description = routine?.description || 'No description';
      
      // Get first step content as prompt
      let firstStepContent = 'No steps';
      if (routine?.steps && routine.steps.length > 0) {
        const firstStep = routine.steps.sort((a, b) => a.order - b.order)[0];
        firstStepContent = firstStep.content || 'No step content';
      }

      // Display each routine in a readable format
      console.log(chalk.cyan(`\n📋 ${routineName} (ID: ${priority.routineId.substring(0, 10)})`));
      console.log(chalk.gray(`   Priority: ${priority.priority}/10  |  Weight: ${priority.weight.toFixed(2)}  |  Executions: ${priority.executionCount}  |  Success rate: ${(priority.successRate * 100).toFixed(1)}%`));
      console.log(chalk.gray(`   Last executed: ${lastExecuted}`));
      console.log(chalk.yellow(`   📝 Description: ${description}`));
      console.log(chalk.green(`   🔧 Prompt: ${firstStepContent.length > 80 ? firstStepContent.substring(0, 80) + '...' : firstStepContent}`));
    }

    console.log(chalk.blue('\n⚙️  Global settings:'));
    console.log(chalk.gray(`Max executions/cycle: ${this.config.globalSettings.maxExecutionsPerCycle}`));
    console.log(chalk.gray(`Cooldown period: ${this.config.globalSettings.cooldownPeriod} seconds`));
    console.log(chalk.gray(`Minimum interval: ${this.config.globalSettings.minimumInterval} seconds`));
  }

  adjustPriority(routineId: string, newPriority: number): boolean {
    const priority = this.config.priorities.find(p => p.routineId === routineId);
    if (priority) {
      priority.priority = Math.max(1, Math.min(10, newPriority));
      this.saveConfig();
      console.log(chalk.green(`✅ Set priority of routine ${routineId} to ${priority.priority}`));
      return true;
    }
    console.log(chalk.red(`❌ Routine ${routineId} not found`));
    return false;
  }

  adjustWeight(routineId: string, newWeight: number): boolean {
    const priority = this.config.priorities.find(p => p.routineId === routineId);
    if (priority) {
      priority.weight = Math.max(0.1, Math.min(5.0, newWeight));
      this.saveConfig();
      console.log(chalk.green(`✅ Set weight of routine ${routineId} to ${priority.weight}`));
      return true;
    }
    console.log(chalk.red(`❌ Routine ${routineId} not found`));
    return false;
  }
} 