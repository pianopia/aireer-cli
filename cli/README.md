# Aireer CLI

> CLI tool for the fully autonomous AI service "aireer"

[![npm version](https://badge.fury.io/js/aireer-cli.svg)](https://badge.fury.io/js/aireer-cli)
[![Node.js Version](https://img.shields.io/node/v/aireer-cli.svg)](https://nodejs.org/)

## 📖 Overview

Aireer CLI is a CLI tool that continuously hits APIs with parallel and scheduled execution. It provides a fully autonomous task execution system that retrieves thought routines and automatically executes them based on priority.

## 🚀 Installation

### Install via npm

```bash
npm install -g aireer-cli
```

### Requirements

- Node.js 18.0.0 or higher

## 📋 Usage

### Basic Commands

#### Login
```bash
aireer login
```

#### Account Creation
```bash
aireer register
```

#### Configuration Management
```bash
# Display current configuration
aireer config --show

# Set LLM mode
aireer config --llm-mode api

# Set Gemini API key
aireer config --gemini-key "YOUR_API_KEY"

# Test Gemini API connection
aireer config --gemini-test

# Display Gemini API setup guide
aireer config --gemini-guide
```

#### Autonomous Execution Mode (Main Feature)
```bash
# Basic execution
aireer autonomous

# Alias
aireer auto

# Execution with options
aireer autonomous \
  --api-url https://api.aireer.work \
  --directory ./workspace \
  --interval 60 \
  --max-executions 3
```

### Other Commands

#### Parallel Execution
```bash
aireer parallel
```

#### Interactive Mode
```bash
aireer interactive
```

#### Routine Management
```bash
# Create routine
aireer routine create

# List routines
aireer routine list

# Delete routine
aireer routine delete <routine-id>

# Execute routine
aireer routine run <routine-id>
```

#### Web Dashboard
```bash
# Start dashboard server (default port: 3001)
aireer dashboard

# Start dashboard on custom port
aireer dashboard --port 8080

# Start dashboard with custom API URL
aireer dashboard --api-url https://api.aireer.work
```

#### Scheduler
```bash
aireer scheduler
```

## 📊 Web Dashboard

Aireer CLIは、リアルタイムでCLIの実行状況を監視できるWebダッシュボードを提供します。

### ダッシュボード機能

- **システム状態監視**: 認証状態、API接続、LLM設定の確認
- **実行統計**: 過去7日間の実行統計、成功率、平均実行時間
- **ルーチン管理**: アクティブなルーチン一覧と実行状況
- **リアルタイム更新**: Socket.IOによるリアルタイムデータ更新
- **実行履歴**: 最近の実行履歴と詳細情報
- **レスポンシブデザイン**: モバイル・デスクトップ対応

### アクセス方法

1. ダッシュボードサーバーを起動:
   ```bash
   aireer dashboard
   ```

2. ブラウザで以下のURLにアクセス:
   ```
   http://localhost:3001
   ```

3. ダッシュボードが表示され、リアルタイムでCLIの状況を監視できます

### ダッシュボード設定

```bash
# カスタムポートで起動
aireer dashboard --port 8080

# カスタムAPI URLを使用
aireer dashboard --api-url https://your-api.example.com
```

## ⚙️ Configuration

### LLM Mode

- `api`: Use LLM via aireer API server
- `gemini-direct`: Connect directly to Gemini API
- `openai-direct`: Connect directly to OpenAI API
- `claude-direct`: Connect directly to Claude (Anthropic) API

### Gemini Direct Mode

When using Gemini API directly:

1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Set API key: `aireer config --gemini-key "YOUR_API_KEY"`
3. Change LLM mode: `aireer config --llm-mode gemini-direct`

### OpenAI Direct Mode

When using OpenAI API directly:

1. Get API key from https://platform.openai.com/api-keys
2. Set API key: `aireer config --openai-key "YOUR_API_KEY"`
3. Change LLM mode: `aireer config --llm-mode openai-direct`

### Claude (Anthropic) Direct Mode

When using Anthropic (Claude) API directly:

1. Get API key from https://console.anthropic.com/settings/keys
2. Set API key: `aireer config --claude-key "YOUR_API_KEY"`
3. Change LLM mode: `aireer config --llm-mode claude-direct`

## 🛠️ Development

### Local Development

```bash
# Clone repository
git clone https://github.com/your-username/aireer-cli.git
cd aireer-cli

# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev
```

### Build

```bash
npm run build
```

## 📄 License

MIT License

## 🤝 Contributing

Pull requests and issue reports are welcome.

## 🔗 Related Links

- [aireer API Documentation](https://api.aireer.work/docs)
- [GitHub Repository](https://github.com/your-username/aireer-cli)
- [Issue Tracker](https://github.com/your-username/aireer-cli/issues) 
