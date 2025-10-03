import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import { ConfigManager } from './config-manager.js';
import { AuthManager } from './auth-manager.js';
import { ExecutionHistory } from './execution-history.js';
import { ApiClient } from './api-client.js';
import { RoutineManager } from './routine-manager.js';
import { displayCompactLogo } from './logo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DashboardData {
  systemStatus: {
    isAuthenticated: boolean;
    apiUrl: string;
    llmMode: string;
    geminiConfigured: boolean;
    openaiConfigured: boolean;
    claudeConfigured: boolean;
    currentTime: string;
  };
  executionStats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    averageDuration: number;
    lastExecution?: string;
  };
  routines: Array<{
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    priority: number;
    weight: number;
    lastExecution?: string;
    executions: number;
    successes: number;
    failures: number;
  }>;
  recentExecutions: Array<{
    id: string;
    routineId: string;
    routineName: string;
    success: boolean;
    message: string;
    error?: string;
    duration: number;
    executedAt: string;
  }>;
}

export class DashboardServer {
  private app: express.Application;
  private server: any;
  private io: Server;
  private configManager: ConfigManager;
  private authManager: AuthManager;
  private apiClient: ApiClient;
  private executionHistory: ExecutionHistory;
  private routineManager: RoutineManager;
  private port: number;
  
  constructor(port: number = 3001, apiUrl: string = 'https://api.aireer.work') {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.configManager = new ConfigManager();
    this.authManager = new AuthManager(apiUrl);
    this.apiClient = new ApiClient(apiUrl);
    this.executionHistory = new ExecutionHistory(this.apiClient);
    this.routineManager = new RoutineManager(apiUrl, '.', this.authManager);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'dashboard-public')));
  }

  private setupRoutes(): void {
    // ダッシュボードのメインページ
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dashboard-public', 'index.html'));
    });

    // API エンドポイント
    this.app.get('/api/dashboard-data', async (req: Request, res: Response) => {
      try {
        const dashboardData = await this.getDashboardData();
        res.json({ success: true, data: dashboardData });
      } catch (error) {
        console.error('Dashboard data fetch error:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // システム状態取得
    this.app.get('/api/system-status', (req: Request, res: Response) => {
      const token = this.authManager.getConfigManager().getToken();
      const isAuthenticated = !!token;
      
      res.json({
        success: true,
        data: {
          isAuthenticated,
          apiUrl: this.apiClient.getBaseUrl(),
          llmMode: this.configManager.getLLMMode(),
          geminiConfigured: this.configManager.isGeminiConfigured(),
          openaiConfigured: this.configManager.isOpenAIConfigured(),
          claudeConfigured: this.configManager.isAnthropicConfigured(),
          currentTime: new Date().toISOString()
        }
      });
    });

    // 実行統計取得
    this.app.get('/api/execution-stats', async (req: Request, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 7;
        const summary = await this.executionHistory.getExecutionSummary(days);
        res.json({ success: true, data: summary });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to fetch execution stats' 
        });
      }
    });

    // ルーチン一覧取得
    this.app.get('/api/routines', async (req: Request, res: Response) => {
      try {
        const routines = await this.routineManager.fetchActiveRoutines();
        const routinesWithStats = await Promise.all(
          routines.map(async (routine) => {
            const summary = await this.executionHistory.getExecutionSummary(7);
            const routineStats = summary.routineBreakdown[routine.id] || {
              executions: 0,
              successes: 0,
              failures: 0
            };
            
            return {
              id: routine.id,
              name: routine.name,
              description: routine.description,
              isActive: routine.isActive,
              priority: (routine as any).priority || 5,
              weight: (routine as any).weight || 1.0,
              executions: routineStats.executions,
              successes: routineStats.successes,
              failures: routineStats.failures
            };
          })
        );
        
        res.json({ success: true, data: routinesWithStats });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to fetch routines' 
        });
      }
    });

    // 最近の実行履歴取得
    this.app.get('/api/recent-executions', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        const executions = await this.executionHistory.fetchFromApi(limit);
        res.json({ success: true, data: executions });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to fetch recent executions' 
        });
      }
    });

    // ヘルスチェック
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ 
        success: true, 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });
  }

  private setupSocketIO(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(chalk.cyan('📱 Dashboard client connected'));
      
      // クライアント接続時に最新データを送信
      this.sendDashboardData(socket);
      
      socket.on('disconnect', () => {
        console.log(chalk.gray('📱 Dashboard client disconnected'));
      });
      
      socket.on('request-refresh', async () => {
        console.log(chalk.blue('🔄 Dashboard refresh requested'));
        await this.sendDashboardData(socket);
      });
    });
  }

  private async sendDashboardData(socket?: Socket): Promise<void> {
    try {
      const dashboardData = await this.getDashboardData();
      
      if (socket) {
        socket.emit('dashboard-data', dashboardData);
      } else {
        this.io.emit('dashboard-data', dashboardData);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error sending dashboard data:'), error);
      
      const errorData = {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      
      if (socket) {
        socket.emit('dashboard-error', errorData);
      } else {
        this.io.emit('dashboard-error', errorData);
      }
    }
  }

  private async getDashboardData(): Promise<DashboardData> {
    const token = this.authManager.getConfigManager().getToken();
    
    // 認証トークンを設定
    if (token) {
      this.apiClient.setAuthToken(token);
    }
    
    // システム状態
    const systemStatus = {
      isAuthenticated: !!token,
      apiUrl: this.apiClient.getBaseUrl(),
      llmMode: this.configManager.getLLMMode(),
      geminiConfigured: this.configManager.isGeminiConfigured(),
      openaiConfigured: this.configManager.isOpenAIConfigured(),
      claudeConfigured: this.configManager.isAnthropicConfigured(),
      currentTime: new Date().toISOString()
    };

    // 実行統計（過去7日間）
    let executionStats;
    try {
      executionStats = await this.executionHistory.getExecutionSummary(7);
    } catch (error) {
      executionStats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        averageDuration: 0
      };
    }

    // ルーチン一覧
    let routines: any[] = [];
    try {
      const activeRoutines = await this.routineManager.fetchActiveRoutines();
      routines = await Promise.all(
        activeRoutines.map(async (routine) => {
          const routineStats = (executionStats.routineBreakdown || {})[routine.id] || {
            executions: 0,
            successes: 0,
            failures: 0
          };
          
          return {
            id: routine.id,
            name: routine.name,
            description: routine.description,
            isActive: routine.isActive,
            priority: (routine as any).priority || 5,
            weight: (routine as any).weight || 1.0,
            executions: routineStats.executions,
            successes: routineStats.successes,
            failures: routineStats.failures
          };
        })
      );
    } catch (error) {
      console.log(chalk.yellow('⚠️  Failed to fetch routines for dashboard'));
    }

    // 最近の実行履歴
    let recentExecutions = [];
    try {
      recentExecutions = await this.executionHistory.fetchFromApi(10);
    } catch (error) {
      console.log(chalk.yellow('⚠️  Failed to fetch recent executions for dashboard'));
      recentExecutions = this.executionHistory.getLocalHistory(10);
    }

    return {
      systemStatus,
      executionStats,
      routines,
      recentExecutions
    };
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        displayCompactLogo();
        console.log(chalk.green(`🌐 Dashboard server started on port ${this.port}`));
        console.log(chalk.cyan(`📊 Access dashboard at: http://localhost:${this.port}`));
        console.log(chalk.gray('Press Ctrl+C to stop the server\n'));
        
        // 定期的にデータを更新してクライアントに送信
        setInterval(async () => {
          await this.sendDashboardData();
        }, 5000); // 5秒ごとに更新
        
        resolve();
      });
    });
  }

  public stop(): void {
    this.server.close();
    console.log(chalk.yellow('🛑 Dashboard server stopped'));
  }
}

// CLIから直接実行される場合
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DashboardServer(3001);
  
  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
  
  server.start().catch(console.error);
}
