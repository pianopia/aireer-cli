# Aireer CLI

**完全自律型AIサービス「aireer」のCLIツール**

Aireer CLIは、API経由で思考ルーチンを取得し、ローカルの優先度設定に基づいて確率的に実行する完全自律型のコマンドラインツールです。ユーザーは一度設定すれば、AIが継続的に思考し、環境に応じたファイル操作やコマンド実行を自動で行います。

## 🚀 クイックスタート

### インストール

```bash
cd cli
npm install
npm run build
```

### グローバルインストール

```bash
npm install -g .
```

### 基本的な使い方

```bash
# 完全自律モードで開始（推奨）
aireer autonomous

# 優先度設定を確認
aireer priority --show

# 特定のルーチンの優先度を変更
aireer priority --set abc123:8
```

## 📖 主要機能

### 🤖 完全自律実行（メイン機能）

**aireerの核心機能**：API から思考ルーチンを定期的に取得し、ローカルの優先度設定に基づいて確率的に実行します。

```bash
# 基本使用法
aireer autonomous
aireer auto  # エイリアス

# カスタム設定
aireer autonomous \
  --api-url https://api.aireer.work \
  --directory ./my-project \
  --interval 120 \
  --max-executions 5
```

**動作の流れ：**
1. API からアクティブな思考ルーチンを取得
2. ローカルの優先度設定ファイル (`.aireer-priorities.json`) を確認
3. 優先度・成功率・前回実行時間を考慮した重み付き確率で選択
4. 選択されたルーチンのプロンプトで LLM API にリクエスト
5. LLM の応答に基づいて自動でファイル操作・コマンド実行
6. 実行結果を記録し、成功率を学習
7. 設定した間隔で継続的に繰り返し

### 🎯 優先度管理

ローカルファイルでルーチンの優先度を管理できます。

```bash
# 現在の優先度設定を表示
aireer priority --show
aireer priority  # デフォルトで表示

# ルーチンの優先度を設定（1-10、10が最高）
aireer priority --set abc123:8

# ルーチンの重みを設定（0.1-5.0、大きいほど確率高）
aireer priority --weight abc123:1.5
```

**優先度計算**：
- 基本重み = 優先度 × 重み係数 × 成功率
- 時間補正 = 前回実行からの経過時間を考慮
- 最終重み = 基本重み × 時間補正

### 🔄 思考ルーチンの定期実行

従来の定期実行モードも利用可能です。

```bash
aireer schedule --interval 30 --endpoints "/api/routines"
```

### ⚡ 高速並列実行

APIの負荷テストや動作確認に使用できます。

```bash
aireer parallel --count 10 --threads 5
```

### 🎯 インタラクティブモード

質問形式で簡単に設定できます。

```bash
aireer interactive
aireer i  # エイリアス
```

### 🔍 API健康状態チェック

```bash
aireer health --url https://api.aireer.work
```

## ⚙️ コマンドリファレンス

### `aireer autonomous` / `aireer auto` （推奨）

完全自律実行モード

**オプション:**
- `--api-url, -u`: APIのベースURL（デフォルト: https://api.aireer.work）
- `--directory, -d`: 作業ディレクトリ（デフォルト: .）
- `--interval, -i`: 実行サイクル間隔（秒）（デフォルト: 60）
- `--llm-endpoint, -e`: LLMエンドポイント（デフォルト: /api/llm/generate）
- `--max-executions, -m`: 1サイクルあたりの最大実行数（デフォルト: 3）

### `aireer priority`

ルーチンの優先度設定を管理

**オプション:**
- `--api-url, -u`: APIのベースURL（デフォルト: https://api.aireer.work）
- `--directory, -d`: 作業ディレクトリ（デフォルト: .）
- `--show`: 現在の優先度設定を表示（デフォルト動作）
- `--set <routineId:priority>`: ルーチンの優先度を設定 (例: abc123:8)
- `--weight <routineId:weight>`: ルーチンの重みを設定 (例: abc123:1.5)

### `aireer schedule`

定期実行モード

**オプション:**
- `--url, -u`: APIのベースURL（デフォルト: https://api.aireer.work）
- `--interval, -i`: 実行間隔（秒）（デフォルト: 30）
- `--endpoints, -e`: カンマ区切りのエンドポイント（デフォルト: /api/todos,/api/routines,/api/messages）
- `--concurrent, -c`: 並列実行数（デフォルト: 3）

### その他のコマンド

- `aireer parallel`: 並列実行モード
- `aireer interactive` / `aireer i`: インタラクティブモード
- `aireer health`: API健康状態チェック

## 💡 使用例

### 完全自律運用（推奨）

```bash
# 基本的な自律運用を開始
aireer autonomous

# 短い間隔で高頻度実行
aireer autonomous --interval 30 --max-executions 5

# 特定のプロジェクトディレクトリで実行
aireer autonomous --directory ./my-project --interval 180
```

### 優先度チューニング

```bash
# まず現在の設定を確認
aireer priority --show

# 情報収集ルーチンの優先度を上げる
aireer priority --set abc123:9

# 定期的なタスクの重みを下げる
aireer priority --weight def456:0.3

# 設定変更後の状況を確認
aireer priority --show
```

### システム監視・負荷テスト

```bash
# API動作確認
aireer health

# 負荷テスト
aireer parallel --count 100 --threads 10

# 継続監視
aireer schedule --interval 60 --endpoints "/"
```

## 🔧 技術仕様

### 自律実行の仕組み

1. **ルーチン取得**: `/api/routines?active=true` からアクティブなルーチンを取得
2. **優先度管理**: `.aireer-priorities.json` でローカル管理
3. **確率的選択**: 重み付き確率でルーチンを選択
4. **LLM実行**: 選択されたルーチンのプロンプトで `/api/llm/generate` を実行
5. **結果処理**: LLMのJSONレスポンスを解析してファイル操作を実行
6. **学習**: 実行結果から成功率を更新

### 対応エンドポイント

- `/api/routines?active=true` - アクティブな思考ルーチン取得
- `/api/llm/generate` - LLM実行API
- `/api/routine-executions` - 実行結果記録
- その他従来のAPI（todos, messages等）

### 優先度設定ファイル

`.aireer-priorities.json` 形式：

```json
{
  "priorities": [
    {
      "routineId": "abc123",
      "priority": 8,
      "weight": 1.5,
      "lastExecuted": "2024-01-01T10:00:00Z",
      "executionCount": 15,
      "successRate": 0.87
    }
  ],
  "globalSettings": {
    "maxExecutionsPerCycle": 3,
    "cooldownPeriod": 300,
    "minimumInterval": 60
  }
}
```

### LLMレスポンス形式

```json
{
  "type": "create|change|delete|execute|done",
  "filepath": "対象ファイルのパス",
  "file": "ファイルの内容",
  "command": "実行するコマンド",
  "directory": "作業ディレクトリ"
}
```

### 要件

- Node.js 18.0.0以上
- 動作中のAireer APIサーバー
- LLM API対応のエンドポイント

## 🛠️ 開発

```bash
# 開発モード
npm run dev

# ビルド
npm run build

# テスト実行
npm start
```

## 📝 aireerについて

aireerは完全自律型AIサービスです。ユーザーが事前に設定した「思考ルーチン」を定期的に取得し、ローカルの優先度設定に基づいて確率的に実行します。

**主な特徴：**
- 🤖 **完全自律**: 一度設定すれば継続的に思考・実行
- 🎯 **優先度管理**: ローカルファイルでの詳細な優先度制御
- 📊 **学習機能**: 実行結果から成功率を学習し選択確率を調整
- ⚡ **並列実行**: 1サイクルで複数ルーチンを同時実行
- 🔄 **継続実行**: クールダウン期間を考慮した効率的な実行
- 📁 **環境認識**: 現在のディレクトリ状態を把握して適切な操作を実行

このCLIツールは、aireerサービスのフロントエンドとして、ローカル環境でのファイル操作とAPIサーバーとの連携を担当します。 