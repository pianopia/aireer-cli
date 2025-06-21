#!/bin/bash

# aireer-cli GitHub アップロード & npm 公開スクリプト

set -e  # エラーが発生したら停止

echo "🚀 aireer-cli GitHub アップロード & npm 公開スクリプト"
echo "=================================================="

# 現在のディレクトリを確認
if [ ! -f "package.json" ]; then
    echo "❌ エラー: package.jsonが見つかりません。cliディレクトリで実行してください。"
    exit 1
fi

# GitHubユーザー名の入力
read -p "GitHub ユーザー名を入力してください: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ エラー: GitHubユーザー名が入力されていません。"
    exit 1
fi

echo "📝 package.jsonのリポジトリ情報を更新中..."

# package.jsonの更新（macOS/Linux用）
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/your-username/$GITHUB_USERNAME/g" package.json
else
    # Linux
    sed -i "s/your-username/$GITHUB_USERNAME/g" package.json
fi

echo "✅ package.json更新完了"

# 依存関係のインストールとビルド
echo "📦 依存関係のインストールとビルド中..."
npm install
npm run build

echo "✅ ビルド完了"

# Git設定の確認
if ! git config user.name >/dev/null 2>&1; then
    echo "⚠️  Git設定が不完全です。設定してください:"
    echo "git config --global user.name \"Your Name\""
    echo "git config --global user.email \"your.email@example.com\""
    exit 1
fi

# Gitリポジトリの初期化（まだ初期化されていない場合）
if [ ! -d ".git" ]; then
    echo "🔧 Gitリポジトリを初期化中..."
    git init
    git add .
    git commit -m "Initial commit: aireer-cli v1.0.0"
    
    echo "🔗 GitHubリポジトリとの連携中..."
    git remote add origin "https://github.com/$GITHUB_USERNAME/aireer-cli.git"
    git branch -M main
    
    echo "📤 GitHubにプッシュ中..."
    echo "⚠️  注意: GitHubに 'aireer-cli' という名前のパブリックリポジトリを事前に作成してください。"
    read -p "GitHubリポジトリを作成しましたか？ (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push -u origin main
        echo "✅ GitHubアップロード完了"
    else
        echo "❌ GitHubリポジトリを作成してから再実行してください。"
        echo "リポジトリ作成URL: https://github.com/new"
        exit 1
    fi
else
    echo "📤 既存のGitリポジトリを更新中..."
    git add .
    git commit -m "Update: Ready for npm publish" || echo "変更がないかコミット済みです"
    git push
    echo "✅ GitHub更新完了"
fi

# npm公開の選択
echo ""
echo "📦 npm公開を行いますか？"
echo "注意: npmアカウントが必要です。事前に 'npm login' を実行してください。"
read -p "npm公開を実行しますか？ (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔍 npm ログイン状態を確認中..."
    if npm whoami >/dev/null 2>&1; then
        echo "✅ npmにログイン済みです"
        
        echo "🔍 パッケージ名の確認中..."
        PACKAGE_NAME=$(node -p "require('./package.json').name")
        
        if npm view "$PACKAGE_NAME" >/dev/null 2>&1; then
            echo "⚠️  パッケージ名 '$PACKAGE_NAME' は既に存在します。"
            echo "package.jsonの 'name' フィールドを変更することをお勧めします。"
            echo "例: @$GITHUB_USERNAME/aireer-cli"
            read -p "このまま続行しますか？ (y/N): " -n 1 -r
            echo
            
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "❌ 公開をキャンセルしました。"
                exit 1
            fi
        fi
        
        echo "🧪 公開前テストの実行中..."
        npm publish --dry-run
        
        echo "📦 npmに公開中..."
        npm publish
        
        echo "🎉 npm公開完了!"
        echo "インストール方法: npm install -g $PACKAGE_NAME"
        echo "パッケージページ: https://www.npmjs.com/package/$PACKAGE_NAME"
        
    else
        echo "❌ npmにログインしていません。"
        echo "npm login を実行してから再度お試しください。"
        exit 1
    fi
else
    echo "📦 npm公開をスキップしました。"
    echo "後で公開する場合は: npm publish"
fi

echo ""
echo "🎉 セットアップ完了!"
echo "=================================================="
echo "GitHubリポジトリ: https://github.com/$GITHUB_USERNAME/aireer-cli"
echo ""
echo "次のステップ:"
echo "1. GitHubリポジトリページでREADMEを確認"
echo "2. リポジトリの About セクションで説明とトピックを設定"
echo "3. ユーザーにインストール方法を案内:"
echo "   npm install -g $PACKAGE_NAME"
echo "==================================================" 