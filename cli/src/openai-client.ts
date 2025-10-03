import chalk from 'chalk';

export interface OpenAIRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface OpenAIResponse {
  content: string | null;
  rawResponse: any;
  success: boolean;
  error?: string;
}

export class OpenAIClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    if (!apiKey) {
      throw new Error('OpenAI APIキーが設定されていません');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateContent(request: OpenAIRequest): Promise<OpenAIResponse> {
    try {
      console.log(chalk.cyan('🤖 OpenAI APIに直接リクエスト中...'));

      const body = {
        model: request.model || this.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: request.prompt }
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2000
      } as any;

      const res: any = await (globalThis as any).fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        return { content: null, rawResponse: errText, success: false, error: `HTTP ${res.status}` };
      }

      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? null;
      return { content, rawResponse: data, success: true };
    } catch (error: any) {
      console.error(chalk.red('❌ OpenAI APIエラー:'), error?.message || error);
      return { content: null, rawResponse: error, success: false, error: error?.message || 'Unknown error' };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log(chalk.blue('🔍 OpenAI API接続テスト中...'));
      const res = await this.generateContent({
        prompt: 'Reply exactly: connection test successful',
        temperature: 0.1,
        maxTokens: 16
      });
      if (res.success && res.content) {
        console.log(chalk.green('✅ OpenAI API接続テスト成功'));
        console.log(chalk.gray(`   レスポンス: ${res.content.substring(0, 100)}...`));
        return true;
      }
      console.log(chalk.red('❌ OpenAI API接続テスト失敗'));
      return false;
    } catch {
      console.log(chalk.red('❌ OpenAI API接続テスト失敗'));
      return false;
    }
  }

  static validateApiKey(apiKey: string): boolean {
    // OpenAIのAPIキーは sk- で始まることが多い
    return /^sk-[A-Za-z0-9]{20,}$/.test(apiKey);
  }
}
