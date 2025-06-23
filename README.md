# aireer-cli

完全自律型AIサービス「aireer」のCLIツール - 思考ルーチンを構造化して自動実行する並列・定期実行ツールです。

## 📦 インストール

### インストール方法（推奨）

```bash
# 最新版をインストール
npm install -g @pianopia/aireer-cli

# 特定のバージョンをインストール  
npm install -g @pianopia/aireer-cli#v1.0.0
```

### 方法2: GitHub Packagesからインストール

### プロジェクトの依存関係として追加

```bash
# package.jsonに追加（GitHubから直接）
npm install @pianopia/aireer-cli

# または GitHub Packagesから
npm install @pianopia/aireer-cli
```

```json
{
  "dependencies": {
    "aireer-cli": "github:pianopia/aireer-cli#v1.0.0"
  }
}
```

## 🚀 クイックスタート

### 1. アカウント作成・ログイン

```bash
# 新規アカウント作成
aireer register

# ログイン
aireer login
```

### 2. 思考ルーチンの作成

```bash
# インタラクティブなルーチン作成
aireer routine create
```

### 3. 自律モードで実行

```bash
# 完全自律モードで実行
aireer autonomous
```

## 🎯 主な機能

### ✨ 思考ルーチン機能

あなたの思考パターンを構造化してルーチンとして登録し、AI自律モードで自動実行できます。

- **📊 分析思考テンプレート**: 問題や状況を構造化して分析
- **💡 創造思考テンプレート**: アイデア発想とブレインストーミング
- **🎯 意思決定テンプレート**: 選択肢を評価して最適な決定
- **🔍 問題解決テンプレート**: 課題特定から解決まで体系的にアプローチ

### 🤖 自律実行モード

登録した思考ルーチンを優先度に基づいて自動実行します：

- アクティブなルーチンの自動取得
- 優先度と重みに基づく実行順序管理
- LLMによる高度な思考プロセス実行
- 実行結果の詳細記録とモニタリング

### 📊 実行履歴とモニタリング

```bash
# 実行履歴の表示
aireer routine history

# 統計情報の確認
aireer routine stats
```

## 🛠️ 利用可能なコマンド

| コマンド | 説明 |
|---------|-----|
| `aireer register` | 新規アカウント作成 |
| `aireer login` | ログイン |
| `aireer logout` | ログアウト |
| `aireer routine create` | 新しい思考ルーチンを作成 |
| `aireer routine list` | 登録済みルーチンの一覧表示 |
| `aireer routine history` | 実行履歴の表示 |
| `aireer routine stats` | 実行統計の表示 |
| `aireer autonomous` | 完全自律モードで実行 |
| `aireer config` | 設定の表示・変更 |
| `aireer config --gemini-guide` | Gemini API設定ガイド |

## ⚙️ 設定

### LLMモードの設定

```bash
# API経由でLLMを使用（デフォルト）
aireer config --llm-mode api

# Gemini APIを直接使用
aireer config --llm-mode gemini-direct
aireer config --gemini-key YOUR_API_KEY
```

### Gemini API設定

```bash
# 設定ガイドを表示
aireer config --gemini-guide

# APIキーを設定
aireer config --gemini-key AIza...

# 接続テスト
aireer config --gemini-test
```

## 🔧 開発者向け情報

### 必要要件

- Node.js >= 18.0.0
- npm または yarn

### ローカル開発

```bash
# リポジトリをクローン
git clone https://github.com/pianopia/aireer-cli.git
cd aireer-cli

# 依存関係をインストール
cd cli && npm install

# 開発モードで実行
npm run dev

# ビルド
npm run build
```

### パッケージング

```bash
# プロジェクトルートでパッケージをビルド
npm run build
npm pack

# ローカルでテストインストール
npm install -g ./pianopia-aireer-cli-1.0.0.tgz
```

### 配布方法

#### GitHub Packagesへの手動公開

```bash
# GitHub Personal Access Token (packages:write権限が必要) で認証
npm login --registry=https://npm.pkg.github.com

# パッケージを公開
npm publish
```

#### リリース作成による自動公開

```bash
# タグを作成してプッシュ
git tag v1.0.0
git push origin v1.0.0

# または GitHub上でリリースを作成
# → GitHub Actionsが自動的にパッケージを公開
```

## 📚 詳細ドキュメント

思考ルーチン機能の詳細については、[README-ROUTINE.md](cli/README-ROUTINE.md)をご覧ください。

## 🌐 APIエンドポイント

- **本番環境**: `https://api.aireer.work`
- **ローカル開発**: `http://localhost:3000`

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

プルリクエストやイシューの報告を歓迎します。

## 🆘 サポート

- [GitHub Issues](https://github.com/pianopia/aireer-cli/issues)
- [公式サイト](https://aireer.work)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/pianopia">pianopia</a>
</p> 