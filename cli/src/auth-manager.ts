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
    console.log(chalk.blue('\n🔐 Logging into aireer'));
    console.log(chalk.gray('━'.repeat(30)));

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email address:',
          validate: (input: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input) || 'Please enter a valid email address';
          }
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          mask: '*',
          validate: (input: string) => {
            return input.length >= 6 || 'Password must be at least 6 characters';
          }
        }
      ]);

      const spinner = ora('Logging in...').start();

      try {
        const response = await this.apiClient.post('/api/auth/login', {
          email: answers.email,
          password: answers.password
        });

        if (response.success) {
          this.configManager.setToken(response.data.token);
          this.configManager.setUser(response.data.user);
          
          spinner.succeed(chalk.green('✅ Login successful!'));
          console.log(chalk.gray(`Welcome, ${response.data.user.name}!`));
          return true;
        } else {
          spinner.fail(chalk.red('❌ Login failed'));
          console.log(chalk.red(response.message || 'Unknown error'));
          return false;
        }
      } catch (error: any) {
        spinner.fail(chalk.red('❌ Login failed'));
        console.log(chalk.red(error.message));
        return false;
      }
    } catch (error) {
      console.log(chalk.yellow('\n⏹️  Login cancelled'));
      return false;
    }
  }

  async register(): Promise<boolean> {
    console.log(chalk.blue('\n📝 Creating aireer account'));
    console.log(chalk.gray('━'.repeat(30)));

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Name:',
          validate: (input: string) => {
            return input.trim().length > 0 || 'Please enter your name';
          }
        },
        {
          type: 'input',
          name: 'email',
          message: 'Email address:',
          validate: (input: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input) || 'Please enter a valid email address';
          }
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          mask: '*',
          validate: (input: string) => {
            return input.length >= 6 || 'Password must be at least 6 characters';
          }
        },
        {
          type: 'password',
          name: 'confirmPassword',
          message: 'Confirm password:',
          mask: '*',
          validate: (input: string, answers: any) => {
            return input === answers.password || 'Passwords do not match';
          }
        }
      ]);

      const spinner = ora('Creating account...').start();

      try {
        const response = await this.apiClient.post('/api/auth/register', {
          name: answers.name,
          email: answers.email,
          password: answers.password
        });

        if (response.success) {
          this.configManager.setToken(response.data.token);
          this.configManager.setUser(response.data.user);
          
          spinner.succeed(chalk.green('✅ Account created successfully!'));
          console.log(chalk.gray(`Welcome, ${response.data.user.name}!`));
          return true;
        } else {
          spinner.fail(chalk.red('❌ Account creation failed'));
          console.log(chalk.red(response.message || 'Unknown error'));
          return false;
        }
      } catch (error: any) {
        spinner.fail(chalk.red('❌ Account creation failed'));
        console.log(chalk.red(error.message));
        return false;
      }
    } catch (error) {
      console.log(chalk.yellow('\n⏹️  Account creation cancelled'));
      return false;
    }
  }

  async logout(): Promise<void> {
    this.configManager.clearAuth();
    console.log(chalk.green('✅ Logged out successfully'));
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
        // Update user information
        this.configManager.setUser(response.data);
        return true;
      } else {
        // Invalid token
        this.configManager.clearAuth();
        return false;
      }
    } catch (error) {
      // Invalid token
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

    console.log(chalk.yellow('\n🔐 Authentication required'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Choose authentication method:',
        choices: [
          { name: 'Login', value: 'login' },
          { name: 'Create new account', value: 'register' },
          { name: 'Cancel', value: 'cancel' }
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