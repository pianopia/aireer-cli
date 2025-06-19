import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';

export interface GeminiRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  timestamp?: string;
}

export interface GeminiResponse {
  content: string | null;
  rawResponse: any;
  success: boolean;
  error?: string;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string, modelName: string = 'gemini-2.0-flash-exp') {
    if (!apiKey) {
      throw new Error('Gemini APIキーが設定されていません');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  async generateContent(request: GeminiRequest): Promise<GeminiResponse> {
    try {
      console.log(chalk.cyan('🤖 Gemini APIに直接リクエスト中...'));
      
      const startTime = Date.now();
      
      // Gemini APIに送信する設定
      const generationConfig = {
        temperature: request.temperature || 0.7,
        maxOutputTokens: request.maxTokens || 2000,
      };

      // リクエストを送信
      const result = await this.model.generateContent({
        contents: [{
          parts: [{
            text: request.prompt
          }]
        }],
        generationConfig
      });

      const responseTime = Date.now() - startTime;
      console.log(chalk.green(`✅ Gemini APIレスポンス受信 (${responseTime}ms)`));

      const response = await result.response;
      const content = response.text();

      return {
        content,
        rawResponse: response,
        success: true
      };

    } catch (error: any) {
      console.error(chalk.red('❌ Gemini APIエラー:'), error.message);

      // レート制限エラーの場合
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        return {
          content: null,
          rawResponse: error,
          success: false,
          error: 'RATE_LIMIT_EXCEEDED'
        };
      }

      // その他のエラー
      return {
        content: null,
        rawResponse: error,
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log(chalk.blue('🔍 Gemini API接続テスト中...'));
      
      const testResponse = await this.generateContent({
        prompt: 'Hello, please respond with "connection test successful".',
        temperature: 0.1,
        maxTokens: 50
      });

      if (testResponse.success && testResponse.content) {
        console.log(chalk.green('✅ Gemini API接続テスト成功'));
        console.log(chalk.gray(`   レスポンス: ${testResponse.content.substring(0, 100)}...`));
        return true;
      } else {
        console.log(chalk.red('❌ Gemini API接続テスト失敗'));
        console.log(chalk.gray(`   エラー: ${testResponse.error}`));
        return false;
      }
    } catch (error) {
      console.log(chalk.red('❌ Gemini API接続テスト失敗'));
      console.error(error);
      return false;
    }
  }

  static validateApiKey(apiKey: string): boolean {
    // Google AI Studio API keyの基本的なフォーマットチェック
    // 通常は "AIza" で始まる39文字の文字列
    const apiKeyPattern = /^AIza[0-9A-Za-z\-_]{35}$/;
    return apiKeyPattern.test(apiKey);
  }
} 