# GitHub アップロード & npm 公開ガイド

このガイドでは、aireer-cliをGitHubにアップロードし、npmでインストール可能にするまでの手順を説明します。

## 📋 事前準備

### 1. GitHubアカウントとリポジトリの作成

1. [GitHub](https://github.com)にログイン
2. 新しいリポジトリを作成
   - Repository name: `aireer-cli`
   - Description: `並列実行と定期実行でAPIを叩き続けるCLIツール`
   - Public or Private: **Public** (npmで公開する場合)
   - Initialize this repository with: **何も選択しない**

### 2. package.jsonの更新

`package.json`の以下の部分を実際のGitHubユーザー名に変更してください：

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/aireer-cli.git"
  },
  "homepage": "https://github.com/YOUR_USERNAME/aireer-cli#readme",
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/aireer-cli/issues"
  }
}
```

`YOUR_USERNAME`を実際のGitHubユーザー名に置き換えてください。

## 🚀 GitHubアップロード手順

### 1. Gitリポジトリの初期化

```bash
cd cli
git init
git add .
git commit -m "Initial commit: aireer-cli v1.0.0"
```

### 2. GitHubリポジトリとの連携

```bash
git remote add origin https://github.com/YOUR_USERNAME/aireer-cli.git
git branch -M main
git push -u origin main
```

## 📦 npm公開手順

### 1. npmアカウントの準備

```bash
# npmにログイン（アカウントがない場合は作成）
npm login
```

### 2. パッケージ名の確認

npmで利用可能なパッケージ名かチェック：

```bash
npm view aireer-cli
```

もし既に存在する場合は、`package.json`の`name`フィールドを変更してください：
- `@your-username/aireer-cli`
- `aireer-cli-fork`
- など

### 3. ビルドとテスト

```bash
# 依存関係をインストール
npm install

# TypeScriptビルド
npm run build

# 動作確認
npm start -- --help
```

### 4. npm公開

```bash
# 公開前の最終確認
npm publish --dry-run

# 実際に公開
npm publish
```

### 5. スコープ付きパッケージの場合

パッケージ名を`@your-username/aireer-cli`にした場合：

```bash
npm publish --access public
```

## ✅ 公開後の確認

### 1. npmでのインストールテスト

```bash
# グローバルインストール
npm install -g aireer-cli

# 動作確認
aireer --version
aireer --help
```

### 2. GitHubページの更新

1. GitHubのリポジトリページでREADMEが正しく表示されることを確認
2. About セクションで以下を設定：
   - Description: `並列実行と定期実行でAPIを叩き続けるCLIツール`
   - Website: npmパッケージページのURL
   - Topics: `cli`, `api`, `automation`, `task-runner`

## 🔄 更新手順

### バージョンアップ時

```bash
# バージョンを上げる
npm version patch  # 1.0.0 → 1.0.1
# または
npm version minor  # 1.0.0 → 1.1.0
# または  
npm version major  # 1.0.0 → 2.0.0

# GitHubにプッシュ
git push origin main --tags

# npmに公開
npm publish
```

## 🎯 ユーザーへの提供情報

公開後、ユーザーには以下の情報を提供してください：

### インストール方法
```bash
npm install -g aireer-cli
```

### 基本的な使用方法
```bash
aireer --help
aireer login
aireer autonomous
```

### GitHubリポジトリ
```
https://github.com/YOUR_USERNAME/aireer-cli
```

### npm パッケージページ
```
https://www.npmjs.com/package/aireer-cli
```

## 🛠️ トラブルシューティング

### よくある問題

1. **パッケージ名が既に存在する**
   - `package.json`の`name`を変更
   - スコープ付きパッケージ名を使用（`@username/package-name`）

2. **npm publishでエラー**
   - `npm login`でログインを確認
   - パッケージ名の重複チェック
   - `npm run build`でビルドエラーがないか確認

3. **CLIが動作しない**
   - `package.json`の`bin`フィールドを確認
   - `dist/index.js`の先頭に`#!/usr/bin/env node`があることを確認
   - ファイルの実行権限を確認

4. **依存関係のエラー**
   - `package.json`の`dependencies`を確認
   - Node.jsバージョンが18.0.0以上であることを確認

## 📞 サポート

問題が発生した場合は、GitHubのIssuesでお気軽にお知らせください。 