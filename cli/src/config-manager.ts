import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export type LLMMode = 'api' | 'gemini-direct';

export interface Config {
  apiUrl: string;
  llmMode: LLMMode;
  geminiApiKey?: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    // ホームディレクトリに設定ファイルを保存
    this.configPath = path.join(os.homedir(), '.aireer-config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  設定ファイルの読み込みに失敗しました'));
    }
    
    // デフォルト設定
    return {
      apiUrl: 'https://api.aireer.work',
      llmMode: 'api'
    };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ 設定ファイルの保存に失敗しました:'), error);
    }
  }

  getApiUrl(): string {
    return this.config.apiUrl;
  }

  setApiUrl(url: string): void {
    this.config.apiUrl = url;
    this.saveConfig();
  }

  getLLMMode(): LLMMode {
    return this.config.llmMode;
  }

  setLLMMode(mode: LLMMode): void {
    this.config.llmMode = mode;
    this.saveConfig();
  }

  getGeminiApiKey(): string | undefined {
    return this.config.geminiApiKey;
  }

  setGeminiApiKey(apiKey: string): void {
    this.config.geminiApiKey = apiKey;
    this.saveConfig();
  }

  clearGeminiApiKey(): void {
    delete this.config.geminiApiKey;
    this.saveConfig();
  }

  getToken(): string | undefined {
    return this.config.token;
  }

  setToken(token: string): void {
    this.config.token = token;
    this.saveConfig();
  }

  getUser(): Config['user'] {
    return this.config.user;
  }

  setUser(user: Config['user']): void {
    this.config.user = user;
    this.saveConfig();
  }

  clearAuth(): void {
    delete this.config.token;
    delete this.config.user;
    this.saveConfig();
  }

  isAuthenticated(): boolean {
    return !!this.config.token;
  }

  isGeminiConfigured(): boolean {
    return this.config.llmMode === 'gemini-direct' && !!this.config.geminiApiKey;
  }

  getConfig(): Config {
    return { ...this.config };
  }

  displayConfig(): void {
    console.log(chalk.blue('\n📋 現在の設定'));
    console.log(chalk.gray('━'.repeat(30)));
    console.log(`API URL: ${chalk.cyan(this.config.apiUrl)}`);
    console.log(`LLMモード: ${chalk.cyan(this.config.llmMode)}`);
    
    if (this.config.llmMode === 'gemini-direct') {
      const hasKey = !!this.config.geminiApiKey;
      console.log(`Gemini APIキー: ${hasKey ? chalk.green('✅ 設定済み') : chalk.red('❌ 未設定')}`);
    }
    
    if (this.config.user) {
      console.log(`ユーザー: ${chalk.green(this.config.user.name)} (${this.config.user.email})`);
      console.log(`認証状態: ${chalk.green('✅ ログイン済み')}`);
    } else {
      console.log(`認証状態: ${chalk.red('❌ 未ログイン')}`);
    }
    console.log();
  }

  // Gemini APIキーの設定ガイド
  displayGeminiSetupGuide(): void {
    console.log(chalk.blue('\n🔑 Gemini API設定ガイド'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log(chalk.white('1. Google AI Studioにアクセス'));
    console.log(chalk.cyan('   https://makersuite.google.com/app/apikey'));
    console.log(chalk.white('2. 新しいAPIキーを作成'));
    console.log(chalk.white('3. 以下のコマンドでAPIキーを設定:'));
    console.log(chalk.cyan('   aireer config --gemini-key YOUR_API_KEY'));
    console.log(chalk.white('4. LLMモードをGemini Directに切り替え:'));
    console.log(chalk.cyan('   aireer config --llm-mode gemini-direct'));
    console.log();
  }
} 