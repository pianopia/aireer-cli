import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export type LLMMode = 'api' | 'gemini-direct' | 'openai-direct' | 'claude-direct';

export interface Config {
  apiUrl: string;
  llmMode: LLMMode;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
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
    // Save configuration file in home directory
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
      console.warn(chalk.yellow('⚠️  Failed to load configuration file'));
    }
    
    // Default configuration
    return {
      apiUrl: 'https://api.aireer.work',
      llmMode: 'api'
    };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ Failed to save configuration file:'), error);
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

  getOpenAIApiKey(): string | undefined {
    return this.config.openaiApiKey;
  }

  setOpenAIApiKey(apiKey: string): void {
    this.config.openaiApiKey = apiKey;
    this.saveConfig();
  }

  clearOpenAIApiKey(): void {
    delete this.config.openaiApiKey;
    this.saveConfig();
  }

  getAnthropicApiKey(): string | undefined {
    return this.config.anthropicApiKey;
  }

  setAnthropicApiKey(apiKey: string): void {
    this.config.anthropicApiKey = apiKey;
    this.saveConfig();
  }

  clearAnthropicApiKey(): void {
    delete this.config.anthropicApiKey;
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

  isOpenAIConfigured(): boolean {
    return this.config.llmMode === 'openai-direct' && !!this.config.openaiApiKey;
  }

  isAnthropicConfigured(): boolean {
    return this.config.llmMode === 'claude-direct' && !!this.config.anthropicApiKey;
  }

  getConfig(): Config {
    return { ...this.config };
  }

  displayConfig(): void {
    console.log(chalk.blue('\n📋 Current Configuration'));
    console.log(chalk.gray('━'.repeat(30)));
    console.log(`API URL: ${chalk.cyan(this.config.apiUrl)}`);
    console.log(`LLM Mode: ${chalk.cyan(this.config.llmMode)}`);

    switch (this.config.llmMode) {
      case 'gemini-direct': {
        const hasKey = !!this.config.geminiApiKey;
        console.log(`Gemini API Key: ${hasKey ? chalk.green('✅ Configured') : chalk.red('❌ Not set')}`);
        break;
      }
      case 'openai-direct': {
        const hasKey = !!this.config.openaiApiKey;
        console.log(`OpenAI API Key: ${hasKey ? chalk.green('✅ Configured') : chalk.red('❌ Not set')}`);
        break;
      }
      case 'claude-direct': {
        const hasKey = !!this.config.anthropicApiKey;
        console.log(`Anthropic API Key: ${hasKey ? chalk.green('✅ Configured') : chalk.red('❌ Not set')}`);
        break;
      }
      default:
        break;
    }
    
    if (this.config.user) {
      console.log(`User: ${chalk.green(this.config.user.name)} (${this.config.user.email})`);
      console.log(`Authentication Status: ${chalk.green('✅ Logged in')}`);
    } else {
      console.log(`Authentication Status: ${chalk.red('❌ Not logged in')}`);
    }
    console.log();
  }

  // Gemini API key setup guide
  displayGeminiSetupGuide(): void {
    console.log(chalk.blue('\n🔑 Gemini API Setup Guide'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log(chalk.white('1. Access Google AI Studio'));
    console.log(chalk.cyan('   https://makersuite.google.com/app/apikey'));
    console.log(chalk.white('2. Create a new API key'));
    console.log(chalk.white('3. Set the API key with the following command:'));
    console.log(chalk.cyan('   aireer config --gemini-key YOUR_API_KEY'));
    console.log(chalk.white('4. Switch LLM mode to Gemini Direct:'));
    console.log(chalk.cyan('   aireer config --llm-mode gemini-direct'));
    console.log();
  }

  // OpenAI API key setup guide
  displayOpenAISetupGuide(): void {
    console.log(chalk.blue('\n🔑 OpenAI API Setup Guide'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log(chalk.white('1. Access OpenAI API Keys page'));
    console.log(chalk.cyan('   https://platform.openai.com/api-keys'));
    console.log(chalk.white('2. Create a new API key'));
    console.log(chalk.white('3. Set the API key with the following command:'));
    console.log(chalk.cyan('   aireer config --openai-key YOUR_API_KEY'));
    console.log(chalk.white('4. Switch LLM mode to OpenAI Direct:'));
    console.log(chalk.cyan('   aireer config --llm-mode openai-direct'));
    console.log();
  }

  // Anthropic (Claude) API key setup guide
  displayClaudeSetupGuide(): void {
    console.log(chalk.blue('\n🔑 Claude (Anthropic) API Setup Guide'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log(chalk.white('1. Access Anthropic API Keys page'));
    console.log(chalk.cyan('   https://console.anthropic.com/settings/keys'));
    console.log(chalk.white('2. Create a new API key'));
    console.log(chalk.white('3. Set the API key with the following command:'));
    console.log(chalk.cyan('   aireer config --claude-key YOUR_API_KEY'));
    console.log(chalk.white('4. Switch LLM mode to Claude Direct:'));
    console.log(chalk.cyan('   aireer config --llm-mode claude-direct'));
    console.log();
  }
}
