import inquirer from 'inquirer';
import chalk from 'chalk';
import { ApiClient } from './api-client.js';
import { ConfigManager } from './config-manager.js';
import ora from 'ora';

export class AuthManager {
  private configManager: ConfigManager;
  private apiClient: ApiClient;

  constructor(apiUrl?: string) {
    this.configManager = new ConfigManager();
    if (apiUrl) {
      this.configManager.setApiUrl(apiUrl);
    }
    this.apiClient = new ApiClient(this.configManager.getApiUrl());
  }

  async login(): Promise<boolean> {
    console.log(chalk.blue('\n🔐 aireerにログインします'));
    console.log(chalk.gray('━'.repeat(30)));

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'メールアドレス:',
          validate: (input: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input) || 'Valid なメールアドレスを入力してください';
          }
        },
        {
          type: 'password',
          name: 'password',
          message: 'パスワード:',
          mask: '*',
          validate: (input: string) => {
            return input.length >= 6 || 'パスワードは6文字以上である必要があります';
          }
        }
      ]);

      const spinner = ora('ログイン中...').start();

      try {
        const response = await this.apiClient.post('/api/auth/login', {
          email: answers.email,
          password: answers.password
        });

        if (response.success) {
          this.configManager.setToken(response.data.token);
          this.configManager.setUser(response.data.user);
          
          spinner.succeed(chalk.green('✅ ログインに成功しました！'));
          console.log(chalk.gray(`ようこそ、${response.data.user.name}さん！`));
          return true;
        } else {
          spinner.fail(chalk.red('❌ ログインに失敗しました'));
          console.log(chalk.red(response.message || 'Unknown error'));
          return false;
        }
      } catch (error: any) {
        spinner.fail(chalk.red('❌ ログインに失敗しました'));
        console.log(chalk.red(error.message));
        return false;
      }
    } catch (error) {
      console.log(chalk.yellow('\n⏹️  ログインがキャンセルされました'));
      return false;
    }
  }

  async register(): Promise<boolean> {
    console.log(chalk.blue('\n📝 aireerアカウントを作成します'));
    console.log(chalk.gray('━'.repeat(30)));

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '名前:',
          validate: (input: string) => {
            return input.trim().length > 0 || '名前を入力してください';
          }
        },
        {
          type: 'input',
          name: 'email',
          message: 'メールアドレス:',
          validate: (input: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input) || 'Valid なメールアドレスを入力してください';
          }
        },
        {
          type: 'password',
          name: 'password',
          message: 'パスワード:',
          mask: '*',
          validate: (input: string) => {
            return input.length >= 6 || 'パスワードは6文字以上である必要があります';
          }
        },
        {
          type: 'password',
          name: 'confirmPassword',
          message: 'パスワード（確認）:',
          mask: '*',
          validate: (input: string, answers: any) => {
            return input === answers.password || 'パスワードが一致しません';
          }
        }
      ]);

      const spinner = ora('アカウントを作成中...').start();

      try {
        const response = await this.apiClient.post('/api/auth/register', {
          name: answers.name,
          email: answers.email,
          password: answers.password
        });

        if (response.success) {
          this.configManager.setToken(response.data.token);
          this.configManager.setUser(response.data.user);
          
          spinner.succeed(chalk.green('✅ アカウント作成に成功しました！'));
          console.log(chalk.gray(`ようこそ、${response.data.user.name}さん！`));
          return true;
        } else {
          spinner.fail(chalk.red('❌ アカウント作成に失敗しました'));
          console.log(chalk.red(response.message || 'Unknown error'));
          return false;
        }
      } catch (error: any) {
        spinner.fail(chalk.red('❌ アカウント作成に失敗しました'));
        console.log(chalk.red(error.message));
        return false;
      }
    } catch (error) {
      console.log(chalk.yellow('\n⏹️  アカウント作成がキャンセルされました'));
      return false;
    }
  }

  async logout(): Promise<void> {
    this.configManager.clearAuth();
    console.log(chalk.green('✅ ログアウトしました'));
  }

  async checkAuthStatus(): Promise<boolean> {
    if (!this.configManager.isAuthenticated()) {
      return false;
    }

    try {
      const apiClient = new ApiClient(this.configManager.getApiUrl());
      apiClient.setAuthToken(this.configManager.getToken()!);
      
      const response = await apiClient.get('/api/auth/me');
      
      if (response.success) {
        // ユーザー情報を更新
        this.configManager.setUser(response.data);
        return true;
      } else {
        // トークンが無効
        this.configManager.clearAuth();
        return false;
      }
    } catch (error) {
      // トークンが無効
      this.configManager.clearAuth();
      return false;
    }
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  async ensureAuthenticated(): Promise<boolean> {
    if (await this.checkAuthStatus()) {
      return true;
    }

    console.log(chalk.yellow('\n🔐 認証が必要です'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '認証方法を選択してください:',
        choices: [
          { name: 'ログイン', value: 'login' },
          { name: '新規アカウント作成', value: 'register' },
          { name: 'キャンセル', value: 'cancel' }
        ]
      }
    ]);

    if (action === 'cancel') {
      return false;
    }

    if (action === 'login') {
      return await this.login();
    } else {
      return await this.register();
    }
  }
} 