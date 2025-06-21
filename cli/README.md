# Aireer CLI

> 完全自律型AIサービス「aireer」のCLIツール

[![npm version](https://badge.fury.io/js/aireer-cli.svg)](https://badge.fury.io/js/aireer-cli)
[![Node.js Version](https://img.shields.io/node/v/aireer-cli.svg)](https://nodejs.org/)

## 📖 概要

Aireer CLIは、並列実行と定期実行でAPIを叩き続けるCLIツールです。思考ルーチンを取得して優先度に基づいて自動実行する完全自律型のタスク実行システムを提供します。

## 🚀 インストール

### npm経由でインストール

```bash
npm install -g aireer-cli
```

### 必要環境

- Node.js 18.0.0以上

## 📋 使用方法

### 基本コマンド

#### ログイン
```bash
aireer login
```

#### アカウント作成
```bash
aireer register
```

#### 設定管理
```bash
# 現在の設定を表示
aireer config --show

# LLMモードを設定
aireer config --llm-mode api

# Gemini APIキーを設定
aireer config --gemini-key "YOUR_API_KEY"

# Gemini API接続テスト
aireer config --gemini-test

# Gemini API設定ガイドを表示
aireer config --gemini-guide
```

#### 自律実行モード（メイン機能）
```bash
# 基本実行
aireer autonomous

# エイリアス
aireer auto

# オプション付き実行
aireer autonomous \
  --api-url https://api.aireer.work \
  --directory ./workspace \
  --interval 60 \
  --max-executions 3
```

### その他のコマンド

#### 並列実行
```bash
aireer parallel
```

#### インタラクティブモード
```bash
aireer interactive
```

#### ルーチン管理
```bash
# ルーチン作成
aireer routine create

# ルーチン一覧
aireer routine list

# ルーチン削除
aireer routine delete <routine-id>

# ルーチン実行
aireer routine run <routine-id>
```

#### スケジューラー
```bash
aireer scheduler
```

## ⚙️ 設定

### LLMモード

- `api`: aireer APIサーバー経由でLLMを使用
- `gemini-direct`: Gemini APIに直接接続

### Gemini Direct モード

Gemini APIを直接使用する場合：

1. [Google AI Studio](https://makersuite.google.com/app/apikey)でAPIキーを取得
2. APIキーを設定: `aireer config --gemini-key "YOUR_API_KEY"`
3. LLMモードを変更: `aireer config --llm-mode gemini-direct`

## 🛠️ 開発

### ローカル開発

```bash
# リポジトリをクローン
git clone https://github.com/your-username/aireer-cli.git
cd aireer-cli

# 依存関係をインストール
npm install

# ビルド
npm run build

# 開発モード
npm run dev
```

### ビルド

```bash
npm run build
```

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

プルリクエストやイシューの報告を歓迎します。

## 🔗 関連リンク

- [aireer API Documentation](https://api.aireer.work/docs)
- [GitHub Repository](https://github.com/your-username/aireer-cli)
- [Issue Tracker](https://github.com/your-username/aireer-cli/issues) 