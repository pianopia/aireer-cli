# aireer-cli 配布設定ガイド

aireer-cliをnpm installできるパッケージとして配布するための設定が完了しました。

## 🎯 配布可能な形式

### 1. インストール方法（推奨）

最も簡単で制約の少ない方法です。

**インストール方法:**
```bash
# グローバルインストール
npm install -g @pianopia/aireer-cli

# プロジェクトの依存関係として
npm install @pianopia/aireer-cli

# 特定のバージョン・ブランチ・コミット
npm install @pianopia/aireer-cli#v1.0.0
npm install @pianopia/aireer-cli#main
npm install @pianopia/aireer-cli#abc123
```

## 📦 設定済みファイル

### package.json
- ✅ プロジェクトルートに配置
- ✅ `bin`設定でCLIツールとして実行可能
- ✅ `files`設定で配布ファイルを制限
- ✅ `prepare`スクリプトで自動ビルド
- ✅ `publishConfig`でGitHub Packages対応

### .npmignore
- ✅ 配布時に除外するファイルを指定
- ✅ ソースファイルを除外してビルド済みファイルのみ配布

### .npmrc
- ✅ GitHub Packagesレジストリ設定

### GitHub Actions (.github/workflows/publish.yml)
- ✅ リリース時の自動公開設定
- ✅ タグプッシュ時の自動ビルド・公開

### README.md
- ✅ インストール方法の詳細説明
- ✅ 両方の配布方法に対応

## 🚀 配布手順

### 手動配布（GitHub Packages）

1. **GitHub Personal Access Token作成**
   - `packages:write`権限が必要
   - Settings > Developer settings > Personal access tokens

2. **認証**
   ```bash
   npm login --registry=https://npm.pkg.github.com
   ```

3. **公開**
   ```bash
   npm version patch
   npm version minor
   npm version major

   npm publish
   ```

### 自動配布（GitHub Actions）

1. **リリース作成**
   ```bash
   # タグを作成してプッシュ
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **または GitHub Web UI でリリース作成**
   - GitHub Actions が自動的にパッケージを公開

## ✅ テスト済み項目

- ✅ `npm run build` - ビルドプロセス
- ✅ `npm pack --dry-run` - パッケージング
- ✅ distフォルダの生成確認
- ✅ 適切なファイル構成

## 📋 パッケージ情報

- **パッケージ名**: `@pianopia/aireer-cli`
- **バージョン**: `1.0.0`
- **実行コマンド**: `aireer`
- **サイズ**: 約66.9KB（パッケージ）/ 329.0KB（展開後）
- **ファイル数**: 58ファイル

## 💡 利用者向けインストール例

```bash
# 方法1: GitHubから直接（認証不要）
npm install -g github:pianopia/aireer-cli

# 方法2: GitHub Packages（認証必要）
echo "@pianopia:registry=https://npm.pkg.github.com" >> .npmrc
npm install -g @pianopia/aireer-cli

# インストール確認
aireer --version
aireer --help
```

## 🔧 メンテナンス

### バージョンアップ時の手順

1. **バージョン更新**
   ```bash
   npm version patch  # 1.0.0 → 1.0.1
   npm version minor  # 1.0.0 → 1.1.0
   npm version major  # 1.0.0 → 2.0.0
   ```

2. **リリース作成**
   ```bash
   git push origin main --tags
   ```

3. **GitHub Actions が自動実行**
   - ビルド
   - パッケージ公開

---

これで aireer-cli は npm install 可能なツールとして配布準備が完了しました！🎉 