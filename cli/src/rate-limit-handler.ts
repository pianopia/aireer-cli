import chalk from 'chalk';

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class RateLimitHandler {
  private static defaultOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000, // 1秒
    maxDelay: 60000, // 60秒
    backoffMultiplier: 2
  };

  /**
   * 指数バックオフでリトライを実行する
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // レート制限エラーでない場合は即座に失敗
        if (!this.isRateLimitError(error)) {
          throw error;
        }

        // 最後の試行の場合は失敗
        if (attempt === config.maxRetries) {
          console.error(chalk.red(`❌ ${config.maxRetries + 1}回の試行後も失敗しました`));
          throw error;
        }

        // バックオフ遅延を計算
        const delay = this.calculateDelay(attempt, config, error);
        
        console.log(chalk.yellow(`⏳ レート制限エラー（試行 ${attempt + 1}/${config.maxRetries + 1}）。${Math.floor(delay / 1000)}秒後にリトライします...`));
        
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * エラーがレート制限関連かどうかを判定
   */
  private static isRateLimitError(error: any): boolean {
    if (!error) return false;

    // HTTPステータスコード429
    if (error.status === 429 || error.code === 429) return true;
    
    // レスポンスにRATE_LIMIT_EXCEEDEDが含まれている
    if (error.response?.data?.error === 'RATE_LIMIT_EXCEEDED') return true;
    
    // エラーメッセージにrate limitが含まれている
    const message = error.message?.toLowerCase() || '';
    return message.includes('rate limit') || 
           message.includes('quota exceeded') || 
           message.includes('too many requests') ||
           message.includes('429');
  }

  /**
   * バックオフ遅延を計算
   */
  private static calculateDelay(attempt: number, config: RetryOptions, error: any): number {
    // API側からretryAfterが指定されている場合はそれを優先
    let baseDelay = config.baseDelay;
    
    if (error.response?.data?.retryAfter) {
      baseDelay = Math.max(error.response.data.retryAfter * 1000, config.baseDelay);
    }

    // 指数バックオフ
    const exponentialDelay = baseDelay * Math.pow(config.backoffMultiplier, attempt);
    
    // ジッターを追加（ランダム性）
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    // 最大遅延時間を超えないようにする
    return Math.min(exponentialDelay + jitter, config.maxDelay);
  }

  /**
   * 指定された時間だけ待機
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * レート制限状況の表示
   */
  static displayRateLimitInfo(error: any): void {
    console.log(chalk.yellow('\n🚫 レート制限情報:'));
    
    if (error.response?.data?.retryAfter) {
      console.log(chalk.gray(`推奨待機時間: ${error.response.data.retryAfter}秒`));
    }
    
    if (error.response?.data?.message) {
      console.log(chalk.gray(`メッセージ: ${error.response.data.message}`));
    }
    
    console.log(chalk.blue('💡 ヒント: 実行間隔を長くすることでレート制限を回避できます'));
    console.log(chalk.gray('例: aireer autonomous --interval 120'));
  }

  /**
   * レート制限を考慮した適応的実行間隔の提案
   */
  static suggestOptimalInterval(errorCount: number, currentInterval: number): number {
    // エラー回数に基づいて間隔を調整
    if (errorCount === 0) return currentInterval;
    
    // エラーが続いている場合は間隔を延長
    const multiplier = Math.min(2 + errorCount * 0.5, 5); // 最大5倍まで
    const suggestedInterval = Math.floor(currentInterval * multiplier);
    
    console.log(chalk.cyan(`🔄 実行間隔を${currentInterval}秒から${suggestedInterval}秒に調整します`));
    
    return suggestedInterval;
  }
} 