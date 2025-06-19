import chalk from 'chalk';
import inquirer from 'inquirer';
import { ApiClient } from './api-client.js';
import { AuthManager } from './auth-manager.js';

interface RoutineStep {
  type: 'condition' | 'action' | 'loop';
  content: string;
  parameters?: any;
  order: number;
}

interface CreateRoutineData {
  name: string;
  description: string;
  isActive: boolean;
  steps: RoutineStep[];
}

export class RoutineCreator {
  private apiClient: ApiClient;
  private authManager: AuthManager;

  constructor(apiUrl: string, authManager: AuthManager) {
    this.apiClient = new ApiClient(apiUrl);
    this.authManager = authManager;
    
    // 認証トークンを設定
    const token = authManager.getConfigManager().getToken();
    if (token) {
      this.apiClient.setAuthToken(token);
    }
  }

  async createThinkingRoutine(): Promise<void> {
    console.log(chalk.blue('🧠 思考ルーチンを作成します'));
    console.log(chalk.gray('以下の質問に答えて、あなたの思考パターンをルーチン化しましょう\n'));

    try {
      // 基本情報の入力
      const basicInfo = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'ルーチンの名前を入力してください:',
          validate: (input: string) => {
            return input.trim().length > 0 ? true : 'ルーチン名は必須です';
          }
        },
        {
          type: 'input',
          name: 'description',
          message: 'ルーチンの説明を入力してください (例: 朝の思考整理、プロジェクト分析):',
          default: '思考ルーチン'
        },
        {
          type: 'confirm',
          name: 'isActive',
          message: '作成後すぐにアクティブ化しますか？',
          default: true
        }
      ]);

      // 思考ステップの定義
      const steps = await this.defineThinkingSteps();

      const routineData: CreateRoutineData = {
        name: basicInfo.name,
        description: basicInfo.description,
        isActive: basicInfo.isActive,
        steps: steps
      };

      // ルーチンの確認
      await this.confirmRoutine(routineData);

      // ルーチンを作成
      await this.submitRoutine(routineData);

    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        console.log(chalk.yellow('\n操作がキャンセルされました'));
      } else {
        console.error(chalk.red('ルーチン作成でエラーが発生しました:'), error);
      }
    }
  }

  private async defineThinkingSteps(): Promise<RoutineStep[]> {
    console.log(chalk.cyan('\n🔄 思考ステップを定義しましょう'));
    console.log(chalk.gray('思考プロセスを分解して、各ステップを定義します\n'));

    const steps: RoutineStep[] = [];
    let stepOrder = 0;

    // 事前定義されたテンプレート選択
    const templateChoice = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'テンプレートを選択するか、カスタムで作成しますか？',
        choices: [
          { name: '📊 分析思考テンプレート - 問題を構造化して分析', value: 'analysis' },
          { name: '💡 創造思考テンプレート - アイデア発想とブレインストーミング', value: 'creative' },
          { name: '🎯 意思決定テンプレート - 選択肢を評価して決定', value: 'decision' },
          { name: '🔍 問題解決テンプレート - 課題特定から解決まで', value: 'problem-solving' },
          { name: '🔧 カスタム - 独自の思考ステップを定義', value: 'custom' }
        ]
      }
    ]);

    switch (templateChoice.template) {
      case 'analysis':
        steps.push(...this.getAnalysisTemplate());
        break;
      case 'creative':
        steps.push(...this.getCreativeTemplate());
        break;
      case 'decision':
        steps.push(...this.getDecisionTemplate());
        break;
      case 'problem-solving':
        steps.push(...this.getProblemSolvingTemplate());
        break;
      case 'custom':
        return await this.defineCustomSteps();
    }

    // テンプレートをカスタマイズするか確認
    const customizeChoice = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'customize',
        message: 'テンプレートをカスタマイズしますか？',
        default: false
      }
    ]);

    if (customizeChoice.customize) {
      return await this.customizeSteps(steps);
    }

    return steps;
  }

  private getAnalysisTemplate(): RoutineStep[] {
    return [
      {
        type: 'condition',
        content: '分析対象を明確化する',
        parameters: { 
          focus: '何を分析するのか、目的は何かを明確にする',
          questions: ['分析の目的は？', '期待する成果は？', '制約条件は？']
        },
        order: 0
      },
      {
        type: 'action',
        content: '情報収集と整理',
        parameters: {
          tasks: ['関連データの収集', '情報の分類と整理', '信頼性の確認']
        },
        order: 1
      },
      {
        type: 'action',
        content: '構造化分析',
        parameters: {
          methods: ['要因分析', 'パターン識別', '関係性の可視化'],
          tools: ['フレームワーク適用', '定量・定性分析']
        },
        order: 2
      },
      {
        type: 'action',
        content: '結論と提案の導出',
        parameters: {
          outputs: ['分析結果のまとめ', '提案事項', '次のアクション']
        },
        order: 3
      }
    ];
  }

  private getCreativeTemplate(): RoutineStep[] {
    return [
      {
        type: 'condition',
        content: '創造的思考の準備',
        parameters: {
          mindset: '既存の枠組みを超えて考える準備',
          environment: 'リラックスした創造的環境の確保'
        },
        order: 0
      },
      {
        type: 'action',
        content: 'アイデア発散',
        parameters: {
          techniques: ['ブレインストーミング', '連想思考', 'マインドマッピング'],
          rules: ['判断を保留', '量を重視', '自由な発想']
        },
        order: 1
      },
      {
        type: 'action',
        content: 'アイデア収束',
        parameters: {
          criteria: ['実現可能性', '独創性', 'インパクト'],
          methods: ['グルーピング', '評価', '組み合わせ']
        },
        order: 2
      },
      {
        type: 'action',
        content: 'アイデア具体化',
        parameters: {
          tasks: ['詳細化', 'プロトタイプ', '実行計画']
        },
        order: 3
      }
    ];
  }

  private getDecisionTemplate(): RoutineStep[] {
    return [
      {
        type: 'condition',
        content: '意思決定の枠組み設定',
        parameters: {
          definition: '決定すべき事項と判断基準の明確化',
          scope: '意思決定の範囲と影響を特定'
        },
        order: 0
      },
      {
        type: 'action',
        content: '選択肢の洗い出し',
        parameters: {
          methods: ['既存選択肢の列挙', '新しい選択肢の発想', '組み合わせ案の検討']
        },
        order: 1
      },
      {
        type: 'action',
        content: '選択肢の評価',
        parameters: {
          criteria: ['効果', 'リスク', 'コスト', '実現可能性'],
          tools: ['評価マトリックス', 'SWOT分析', 'シナリオ分析']
        },
        order: 2
      },
      {
        type: 'action',
        content: '最終決定と実行計画',
        parameters: {
          decision: '最適解の選択と根拠',
          planning: ['実行ステップ', 'リスク対策', '成果測定']
        },
        order: 3
      }
    ];
  }

  private getProblemSolvingTemplate(): RoutineStep[] {
    return [
      {
        type: 'condition',
        content: '問題の特定と定義',
        parameters: {
          identification: '真の問題を特定する',
          definition: '問題を具体的かつ明確に定義'
        },
        order: 0
      },
      {
        type: 'action',
        content: '原因分析',
        parameters: {
          methods: ['5つのなぜ', '魚骨図', '要因分析'],
          depth: '根本原因まで掘り下げる'
        },
        order: 1
      },
      {
        type: 'action',
        content: '解決策の発想と評価',
        parameters: {
          generation: ['ブレインストーミング', 'ベストプラクティス調査'],
          evaluation: ['効果性', '実現可能性', 'コスト']
        },
        order: 2
      },
      {
        type: 'action',
        content: '解決策の実装と検証',
        parameters: {
          implementation: ['実行計画', 'リソース確保', 'タイムライン'],
          validation: ['効果測定', 'フィードバック', '改善']
        },
        order: 3
      }
    ];
  }

  private async defineCustomSteps(): Promise<RoutineStep[]> {
    const steps: RoutineStep[] = [];
    let addMore = true;
    let order = 0;

    console.log(chalk.yellow('カスタム思考ステップを定義します'));
    
    while (addMore) {
      const stepInfo = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: `ステップ ${order + 1} の種類を選択してください:`,
          choices: [
            { name: '🔍 条件/判断 - 状況を評価し、条件をチェック', value: 'condition' },
            { name: '⚡ アクション - 具体的な行動や処理を実行', value: 'action' },
            { name: '🔄 ループ - 繰り返し処理や反復思考', value: 'loop' }
          ]
        },
        {
          type: 'input',
          name: 'content',
          message: 'ステップの内容を記述してください:',
          validate: (input: string) => {
            return input.trim().length > 0 ? true : 'ステップの内容は必須です';
          }
        },
        {
          type: 'input',
          name: 'parameters',
          message: '追加のパラメータ (JSON形式、省略可能):',
          default: '',
          filter: (input: string) => {
            if (!input.trim()) return undefined;
            try {
              return JSON.parse(input);
            } catch {
              return { note: input };
            }
          }
        }
      ]);

      steps.push({
        type: stepInfo.type,
        content: stepInfo.content,
        parameters: stepInfo.parameters,
        order: order
      });

      order++;

      const continueChoice = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: '他のステップを追加しますか？',
          default: order < 5
        }
      ]);

      addMore = continueChoice.continue;
    }

    return steps;
  }

  private async customizeSteps(steps: RoutineStep[]): Promise<RoutineStep[]> {
    console.log(chalk.cyan('\n現在のステップ:'));
    steps.forEach((step, index) => {
      console.log(chalk.gray(`${index + 1}. [${step.type}] ${step.content}`));
    });

    const customizeChoice = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'actions',
        message: 'カスタマイズしたい操作を選択してください:',
        choices: [
          { name: 'ステップを追加', value: 'add' },
          { name: 'ステップを編集', value: 'edit' },
          { name: 'ステップを削除', value: 'delete' },
          { name: 'ステップの順序を変更', value: 'reorder' }
        ]
      }
    ]);

    // TODO: カスタマイズ機能の詳細実装
    // 現在は簡略版として、元のステップをそのまま返す
    return steps;
  }

  private async confirmRoutine(routineData: CreateRoutineData): Promise<void> {
    console.log(chalk.cyan('\n📋 ルーチン確認'));
    console.log(chalk.white(`名前: ${routineData.name}`));
    console.log(chalk.white(`説明: ${routineData.description}`));
    console.log(chalk.white(`アクティブ: ${routineData.isActive ? 'はい' : 'いいえ'}`));
    console.log(chalk.white(`ステップ数: ${routineData.steps.length}`));

    console.log(chalk.cyan('\nステップ詳細:'));
    routineData.steps.forEach((step, index) => {
      console.log(chalk.gray(`  ${index + 1}. [${step.type}] ${step.content}`));
    });

    const confirmation = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'この内容でルーチンを作成しますか？',
        default: true
      }
    ]);

    if (!confirmation.confirmed) {
      throw new Error('Routine creation cancelled');
    }
  }

  private async submitRoutine(routineData: CreateRoutineData): Promise<void> {
    try {
      console.log(chalk.blue('🚀 ルーチンを作成中...'));
      
      const response = await this.apiClient.post('/api/routines', routineData);
      
      if (response.success) {
        console.log(chalk.green('✅ 思考ルーチンが正常に作成されました！'));
        console.log(chalk.white(`ルーチンID: ${response.data.id}`));
        console.log(chalk.white(`名前: ${response.data.name}`));
        console.log(chalk.white(`アクティブ: ${response.data.isActive ? 'はい' : 'いいえ'}`));
        
        if (response.data.isActive) {
          console.log(chalk.cyan('\n🤖 このルーチンは自律モードで自動実行されます'));
          console.log(chalk.gray('  `aireer autonomous` コマンドで自律モードを開始できます'));
        }
      } else {
        console.error(chalk.red('❌ ルーチン作成に失敗しました:'), response.message);
      }
    } catch (error) {
      console.error(chalk.red('❌ ルーチン作成でエラーが発生しました:'), error);
    }
  }

  async listRoutines(): Promise<void> {
    try {
      console.log(chalk.blue('📋 ルーチン一覧を取得中...'));
      
      const response = await this.apiClient.get('/api/routines');
      
      if (response.success && response.data) {
        if (response.data.length === 0) {
          console.log(chalk.yellow('📝 登録されているルーチンはありません'));
          console.log(chalk.gray('  `aireer routine create` で新しいルーチンを作成できます'));
          return;
        }

        console.log(chalk.green(`✅ ${response.data.length}個のルーチンが見つかりました\n`));
        
        response.data.forEach((routine: any, index: number) => {
          const status = routine.isActive ? chalk.green('🟢 アクティブ') : chalk.gray('⚫ 非アクティブ');
          console.log(chalk.white(`${index + 1}. ${routine.name} ${status}`));
          console.log(chalk.gray(`   ID: ${routine.id}`));
          console.log(chalk.gray(`   説明: ${routine.description}`));
          console.log(chalk.gray(`   ステップ数: ${routine.steps?.length || 0}`));
          console.log(chalk.gray(`   作成日: ${new Date(routine.createdAt).toLocaleString()}`));
          console.log('');
        });
      } else {
        console.log(chalk.yellow('⚠️  ルーチンの取得に失敗しました'));
      }
    } catch (error) {
      console.error(chalk.red('❌ ルーチン一覧取得でエラーが発生しました:'), error);
    }
  }

  async deleteRoutine(routineId?: string): Promise<void> {
    try {
      let targetRoutineId = routineId;
      
      // ルーチンIDが指定されていない場合、一覧から選択
      if (!targetRoutineId) {
        console.log(chalk.blue('🗑️  削除するルーチンを選択してください'));
        targetRoutineId = await this.selectRoutineForDeletion();
        
        if (!targetRoutineId) {
          console.log(chalk.yellow('削除がキャンセルされました'));
          return;
        }
      }

      // 削除対象のルーチン詳細を取得・表示
      const routineDetails = await this.getRoutineDetails(targetRoutineId);
      if (!routineDetails) {
        console.log(chalk.red('❌ 指定されたルーチンが見つかりません'));
        return;
      }

      // 削除確認
      const confirmed = await this.confirmDeletion(routineDetails);
      if (!confirmed) {
        console.log(chalk.yellow('削除がキャンセルされました'));
        return;
      }

      // ルーチン削除実行
      await this.executeRoutineDeletion(targetRoutineId);

    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        console.log(chalk.yellow('\n操作がキャンセルされました'));
      } else {
        console.error(chalk.red('❌ ルーチン削除でエラーが発生しました:'), error);
      }
    }
  }

  private async selectRoutineForDeletion(): Promise<string | undefined> {
    try {
      const response = await this.apiClient.get('/api/routines');
      
      if (!response.success || !response.data || response.data.length === 0) {
        console.log(chalk.yellow('削除可能なルーチンがありません'));
        return undefined;
      }

      const choices = response.data.map((routine: any) => ({
        name: `${routine.name} ${routine.isActive ? chalk.green('(アクティブ)') : chalk.gray('(非アクティブ)')} - ${routine.description}`,
        value: routine.id,
        short: routine.name
      }));

      choices.push({
        name: chalk.gray('キャンセル'),
        value: undefined,
        short: 'キャンセル'
      });

      const selection = await inquirer.prompt([
        {
          type: 'list',
          name: 'routineId',
          message: '削除するルーチンを選択してください:',
          choices: choices,
          pageSize: 10
        }
      ]);

      return selection.routineId;
    } catch (error) {
      console.error(chalk.red('ルーチン一覧の取得に失敗しました:'), error);
      return undefined;
    }
  }

  private async getRoutineDetails(routineId: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`/api/routines/${routineId}`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return null;
      }
    } catch (error) {
      console.error(chalk.red('ルーチン詳細の取得に失敗しました:'), error);
      return null;
    }
  }

  private async confirmDeletion(routine: any): Promise<boolean> {
    console.log(chalk.red('\n⚠️  削除対象のルーチン詳細'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log(chalk.white(`名前: ${routine.name}`));
    console.log(chalk.white(`説明: ${routine.description}`));
    console.log(chalk.white(`状態: ${routine.isActive ? chalk.green('アクティブ') : chalk.gray('非アクティブ')}`));
    console.log(chalk.white(`作成日: ${new Date(routine.createdAt).toLocaleString()}`));
    
    if (routine.steps && routine.steps.length > 0) {
      console.log(chalk.white(`ステップ数: ${routine.steps.length}`));
      console.log(chalk.cyan('\nステップ詳細:'));
      routine.steps.forEach((step: any, index: number) => {
        console.log(chalk.gray(`  ${index + 1}. [${step.type}] ${step.content}`));
      });
    }

    console.log(chalk.red('\n⚠️  警告: この操作は取り消せません！'));
    
    if (routine.isActive) {
      console.log(chalk.yellow('⚠️  このルーチンはアクティブです。削除すると自律モードで実行されなくなります。'));
    }

    const confirmation = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: chalk.red('本当にこのルーチンを削除しますか？'),
        default: false
      }
    ]);

    if (confirmation.confirmed) {
      // 二重確認
      const doubleConfirmation = await inquirer.prompt([
        {
          type: 'input',
          name: 'routineName',
          message: `確認のため、ルーチン名「${routine.name}」を入力してください:`,
          validate: (input: string) => {
            return input === routine.name ? true : 'ルーチン名が一致しません';
          }
        }
      ]);

      return doubleConfirmation.routineName === routine.name;
    }

    return false;
  }

  private async executeRoutineDeletion(routineId: string): Promise<void> {
    try {
      console.log(chalk.blue('🗑️  ルーチンを削除中...'));
      
      const response = await this.apiClient.delete(`/api/routines/${routineId}`);
      
      if (response.success) {
        console.log(chalk.green('✅ ルーチンが正常に削除されました'));
        console.log(chalk.gray('ルーチンに関連する実行履歴も削除されました'));
      } else {
        console.error(chalk.red('❌ ルーチンの削除に失敗しました:'), response.message || 'Unknown error');
      }
    } catch (error: any) {
      if (error.message?.includes('404')) {
        console.error(chalk.red('❌ 指定されたルーチンが見つかりません'));
      } else if (error.message?.includes('403')) {
        console.error(chalk.red('❌ このルーチンを削除する権限がありません'));
      } else {
        console.error(chalk.red('❌ ルーチン削除でエラーが発生しました:'), error);
      }
    }
  }
} 