import chalk from 'chalk';

export interface AnthropicRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AnthropicResponse {
  content: string | null;
  rawResponse: any;
  success: boolean;
  error?: string;
}

export class AnthropicClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-latest') {
    if (!apiKey) {
      throw new Error('Anthropic APIキーが設定されていません');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateContent(request: AnthropicRequest): Promise<AnthropicResponse> {
    try {
      console.log(chalk.cyan('🤖 Anthropic (Claude) APIに直接リクエスト中...'));

      const body = {
        model: request.model || this.model,
        max_tokens: request.maxTokens ?? 2000,
        temperature: request.temperature ?? 0.7,
        messages: [
          { role: 'user', content: request.prompt }
        ]
      } as any;

      const res: any = await (globalThis as any).fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        return { content: null, rawResponse: errText, success: false, error: `HTTP ${res.status}` };
      }

      const data: any = await res.json();
      // contentは配列。textブロックを抽出
      const textBlock = (data?.content || []).find((b: any) => b?.type === 'text');
      const content = textBlock?.text ?? null;
      return { content, rawResponse: data, success: true };
    } catch (error: any) {
      console.error(chalk.red('❌ Anthropic APIエラー:'), error?.message || error);
      return { content: null, rawResponse: error, success: false, error: error?.message || 'Unknown error' };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log(chalk.blue('🔍 Anthropic API接続テスト中...'));
      const res = await this.generateContent({
        prompt: 'Reply exactly: connection test successful',
        temperature: 0.1,
        maxTokens: 16
      });
      if (res.success && res.content) {
        console.log(chalk.green('✅ Anthropic API接続テスト成功'));
        console.log(chalk.gray(`   レスポンス: ${res.content.substring(0, 100)}...`));
        return true;
      }
      console.log(chalk.red('❌ Anthropic API接続テスト失敗'));
      return false;
    } catch {
      console.log(chalk.red('❌ Anthropic API接続テスト失敗'));
      return false;
    }
  }

  static validateApiKey(apiKey: string): boolean {
    // AnthropicのAPIキーは作成規則が公開されていないが、英数字かつ長め
    return /^[A-Za-z0-9_\-]{20,}$/.test(apiKey);
  }
}
