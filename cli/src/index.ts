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
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get package.json version dynamically with fallback
function getPackageVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    // Multiple fallback strategies for different installation scenarios
    const possiblePaths = [
      // For development (root package.json)
      join(__dirname, '..', '..', 'package.json'),
      // For local cli development
      join(__dirname, '..', 'package.json'),
      // For npm global install (look for package.json in the package directory)
      join(__dirname, 'package.json'),
      // Alternative global install path
      join(__dirname, '..', '..', '..', 'package.json')
    ];
    
    for (const packagePath of possiblePaths) {
      try {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        if (packageJson.version && packageJson.name === '@pianopia/aireer-cli') {
          return packageJson.version;
        }
      } catch {
        // Continue to next path
        continue;
      }
    }
    
    // Ultimate fallback if all paths fail
    return '1.0.7';
  } catch {
    return '1.0.7';
  }
}

program
  .name('aireer')
  .description('CLI tool for the fully autonomous AI service "aireer"')
  .version(getPackageVersion(), '-v, --version', 'Display version number');

// Login
program
  .command('login')
  .description('Login to aireer')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .action(async (options: any) => {
    displayCompactLogo();
    const authManager = new AuthManager(options.apiUrl);
    await authManager.login();
  });

// Account creation
program
  .command('register')
  .description('Create a new aireer account')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .action(async (options: any) => {
    displayCompactLogo();
    const authManager = new AuthManager(options.apiUrl);
    await authManager.register();
  });

// Logout
program
  .command('logout')
  .description('Logout from aireer')
  .action(async () => {
    displayCompactLogo();
    const authManager = new AuthManager();
    await authManager.logout();
  });

// Configuration display/modification
program
  .command('config')
  .description('Display/modify configuration')
  .option('--show', 'Display current configuration')
  .option('--llm-mode <mode>', 'Set LLM mode (api | gemini-direct)')
  .option('--gemini-key <key>', 'Set Gemini API key')
  .option('--gemini-test', 'Test Gemini API connection')
  .option('--gemini-guide', 'Display Gemini API setup guide')
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
        console.log(chalk.green(`✅ LLM mode set to "${options.llmMode}"`));
        
        if (options.llmMode === 'gemini-direct' && !configManager.getGeminiApiKey()) {
          console.log(chalk.yellow('⚠️  To use Gemini Direct mode, you need to set an API key'));
          configManager.displayGeminiSetupGuide();
        }
      } else {
        console.log(chalk.red('❌ Invalid LLM mode. Please specify "api" or "gemini-direct".'));
        return;
      }
    }
    
    // Gemini APIキー設定
    if (options.geminiKey) {
      const { GeminiClient } = await import('./gemini-client.js');
      
      if (!GeminiClient.validateApiKey(options.geminiKey)) {
        console.log(chalk.red('❌ Invalid Gemini API key format'));
        console.log(chalk.gray('   Correct format: AIza... (39 characters)'));
        return;
      }
      
      configManager.setGeminiApiKey(options.geminiKey);
      console.log(chalk.green('✅ Gemini API key has been set'));
      
      // 自動的にLLMモードをgemini-directに変更するか確認
      if (configManager.getLLMMode() !== 'gemini-direct') {
        const inquirer = await import('inquirer');
        const { switchMode } = await inquirer.default.prompt([{
          type: 'confirm',
          name: 'switchMode',
          message: 'Switch LLM mode to Gemini Direct?',
          default: true
        }]);
        
        if (switchMode) {
          configManager.setLLMMode('gemini-direct');
          console.log(chalk.green('✅ Switched LLM mode to Gemini Direct'));
        }
      }
    }
    
    // Gemini API接続テスト
    if (options.geminiTest) {
      const apiKey = configManager.getGeminiApiKey();
      if (!apiKey) {
        console.log(chalk.red('❌ Gemini API key is not set'));
        configManager.displayGeminiSetupGuide();
        return;
      }
      
      try {
        const { GeminiClient } = await import('./gemini-client.js');
        const geminiClient = new GeminiClient(apiKey);
        const success = await geminiClient.testConnection();
        
        if (success) {
          console.log(chalk.green('🎉 Gemini API connection test successful!'));
        } else {
          console.log(chalk.red('❌ Gemini API connection test failed'));
        }
      } catch (error) {
        console.log(chalk.red('❌ Gemini API connection test failed'));
        console.error(error);
      }
      return;
    }
    
    // デフォルト動作: 設定表示
    if (!options.llmMode && !options.geminiKey && !options.geminiTest) {
      configManager.displayConfig();
    }
  });

// Autonomous execution mode (main feature)
program
  .command('autonomous')
  .alias('auto')
  .description('Fully autonomous mode - retrieve thought routines and automatically execute based on priority')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .option('-d, --directory <directory>', 'Working directory', '.')
  .option('-i, --interval <seconds>', 'Execution cycle interval (seconds)', '60')
  .option('-e, --llm-endpoint <endpoint>', 'LLM endpoint', '/api/llm/generate')
  .option('-m, --max-executions <number>', 'Maximum executions per cycle', '3')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    const configManager = authManager.getConfigManager();
    
    // LLMモードに応じた認証チェック
    const llmMode = configManager.getLLMMode();
    const useGeminiDirect = llmMode === 'gemini-direct';
    
    if (!useGeminiDirect) {
      // Authentication required for API mode
      if (!(await authManager.ensureAuthenticated())) {
        console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
        process.exit(1);
      }
    } else {
      // API key required for Gemini direct mode
      if (!configManager.isGeminiConfigured()) {
        console.log(chalk.red('❌ Gemini API key is not set.'));
        console.log(chalk.cyan('Please set the API key with the following command:'));
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
        
        console.log(chalk.blue('🔍 Checking Gemini API connection...'));
        const connectionOk = await geminiClient.testConnection();
        if (!connectionOk) {
          console.log(chalk.red('❌ Cannot connect to Gemini API. Please check your API key.'));
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red('❌ Failed to initialize Gemini client:'), error);
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

// Thought routine management commands
const routineCommand = program
  .command('routine')
  .description('Create and manage thought routines');

// Create thought routine
routineCommand
  .command('create')
  .description('Create a new thought routine')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .option('-n, --name <name>', 'Routine name (for non-interactive mode)')
  .option('-d, --description <description>', 'Routine description (for non-interactive mode)')
  .option('-t, --template <template>', 'Template type: analysis, creative, decision, problem-solving (for non-interactive mode)')
  .option('--active', 'Set routine as active (default: true for non-interactive mode)')
  .option('--inactive', 'Set routine as inactive')
  .option('-y, --yes', 'Skip confirmation prompts (non-interactive mode)')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // Authentication check
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
      process.exit(1);
    }

    displayCompactLogo();
    const routineCreator = new RoutineCreator(options.apiUrl, authManager);
    
    // Check if non-interactive mode
    const isNonInteractive = options.name && options.template;
    if (isNonInteractive) {
      await routineCreator.createRoutineNonInteractive({
        name: options.name,
        description: options.description || 'Thought routine',
        template: options.template,
        isActive: options.inactive ? false : true,
        skipConfirmation: options.yes
      });
    } else {
      await routineCreator.createThinkingRoutine();
    }
  });

// Display routine list
routineCommand
  .command('list')
  .description('Display list of registered thought routines')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // Authentication check
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
      process.exit(1);
    }

    displayCompactLogo();
    const routineCreator = new RoutineCreator(options.apiUrl, authManager);
    await routineCreator.listRoutines();
  });

// Display execution history
routineCommand
  .command('history')
  .description('Display routine execution history')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .option('-l, --limit <number>', 'Number of history entries to display', '20')
  .option('-r, --routine-id <id>', 'Filter by specific routine ID')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // Authentication check
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
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

// Display execution statistics
routineCommand
  .command('stats')
  .description('Display routine execution statistics')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .option('-d, --days <number>', 'Number of days to display statistics for', '7')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // Authentication check
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
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

// Delete routine
routineCommand
  .command('delete')
  .alias('remove')
  .alias('rm')
  .description('Delete a thought routine')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .option('-i, --id <routineId>', 'ID of the routine to delete (if not specified, select from list)')
  .option('-y, --yes', 'Skip confirmation prompts (non-interactive mode)')
  .option('-f, --force', 'Force deletion without detailed confirmation (alias for --yes)')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // Authentication check
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
      process.exit(1);
    }

    displayCompactLogo();
    const routineCreator = new RoutineCreator(options.apiUrl, authManager);
    const skipConfirmation = options.yes || options.force;
    await routineCreator.deleteRoutine(options.id, skipConfirmation);
  });

// Priority management command
program
  .command('priority')
  .description('Manage routine priority settings')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .option('-d, --directory <directory>', 'Working directory', '.')
  .option('--show', 'Display current priority settings')
  .option('--set <routineId:priority>', 'Set routine priority (e.g., abc123:8)')
  .option('--weight <routineId:weight>', 'Set routine weight (e.g., abc123:1.5)')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.apiUrl);
    
    // Authentication check
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
      process.exit(1);
    }

    displayCompactLogo();
    const routineManager = new RoutineManager(options.apiUrl, options.directory, authManager);
    
    if (options.show) {
      console.log(chalk.blue('📊 Displaying routine priority settings...'));
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
        console.log(chalk.red('❌ Invalid format. Example: --set abc123:8'));
      }
      return;
    }
    
    if (options.weight) {
      const [routineId, weight] = options.weight.split(':');
      if (routineId && weight) {
        routineManager.adjustWeight(routineId, parseFloat(weight));
      } else {
        console.log(chalk.red('❌ Invalid format. Example: --weight abc123:1.5'));
      }
      return;
    }
    
    // Default: display priority settings
    console.log(chalk.blue('📊 Displaying routine priority settings...'));
    const routines = await routineManager.fetchActiveRoutines();
    routineManager.updateRoutinePriorities(routines);
    await routineManager.getRoutinePriorityInfo();
  });

program
  .command('schedule')
  .description('Continuously hit APIs with scheduled execution')
  .option('-u, --url <url>', 'API base URL', 'https://api.aireer.work')
  .option('-i, --interval <seconds>', 'Execution interval (seconds)', '30')
  .option('-e, --endpoints <endpoints>', 'Comma-separated endpoints', '/api/todos,/api/routines,/api/messages')
  .option('-c, --concurrent <number>', 'Number of concurrent executions', '3')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.url);
    
    // Authentication check
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
      process.exit(1);
    }

    console.log(chalk.blue('🚀 Starting scheduled execution mode...'));
    console.log(chalk.gray(`Base URL: ${options.url}`));
    console.log(chalk.gray(`Execution interval: ${options.interval} seconds`));
    console.log(chalk.gray(`Endpoints: ${options.endpoints}`));
    console.log(chalk.gray(`Concurrent executions: ${options.concurrent}`));
    
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
  .description('Execute API requests in parallel')
  .option('-u, --url <url>', 'API base URL', 'https://api.aireer.work')
  .option('-e, --endpoints <endpoints>', 'Comma-separated endpoints', '/api/todos,/api/routines,/api/messages')
  .option('-c, --count <number>', 'Number of executions per endpoint', '5')
  .option('-t, --threads <number>', 'Number of parallel executions', '10')
  .action(async (options: any) => {
    const authManager = new AuthManager(options.url);
    
    // Authentication check
    if (!(await authManager.ensureAuthenticated())) {
      console.log(chalk.red('❌ Authentication required. Please login with "aireer login".'));
      process.exit(1);
    }

    console.log(chalk.blue('⚡ Starting parallel execution mode...'));
    console.log(chalk.gray(`Base URL: ${options.url}`));
    console.log(chalk.gray(`Endpoints: ${options.endpoints}`));
    console.log(chalk.gray(`Execution count: ${options.count}`));
    console.log(chalk.gray(`Parallel executions: ${options.threads}`));
    
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
  .description('Configure with interactive mode')
  .action(async () => {
    displayCompactLogo();
    console.log(chalk.blue('🎯 Starting interactive mode...'));
    await setupInteractiveMode();
  });

program
  .command('health')
  .description('Check API health status')
  .option('-u, --url <url>', 'API base URL', 'https://api.aireer.work')
  .action(async (options: any) => {
    const { checkApiHealth } = await import('./health.js');
    await checkApiHealth(options.url);
  });

program
  .command('dashboard')
  .description('Start web dashboard server')
  .option('-p, --port <port>', 'Port number for dashboard server', '3001')
  .option('-u, --api-url <url>', 'API base URL', 'https://api.aireer.work')
  .action(async (options: any) => {
    displayCompactLogo();
    const { DashboardServer } = await import('./dashboard-server.js');
    
    const port = parseInt(options.port);
    const server = new DashboardServer(port, options.apiUrl);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      server.stop();
      process.exit(0);
    });
    
    await server.start();
  });

// Display help by default
if (process.argv.length <= 2) {
  displayLogo();
  program.help();
}

program.parse(process.argv); 