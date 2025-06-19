#!/bin/bash

# Aireer CLI テストスクリプト

echo "🧪 Aireer CLI をテストしています..."

# ビルドの確認
if [ ! -f "dist/index.js" ]; then
    echo "⚠️  dist/index.js が見つかりません。ビルドを実行します..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ ビルドに失敗しました"
        exit 1
    fi
fi

echo "✅ ビルド確認完了"

# CLIの基本動作テスト
echo "🔍 基本動作をテスト中..."

# ヘルプコマンドのテスト
echo "  - ヘルプコマンドをテスト..."
npm start -- --help > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ ヘルプコマンドの実行に失敗しました"
    exit 1
fi

# バージョンコマンドのテスト
echo "  - バージョンコマンドをテスト..."
npm start -- --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ バージョンコマンドの実行に失敗しました"
    exit 1
fi

echo "✅ 基本動作テスト完了"

# API接続テスト（オプション）
if [ "$1" = "--with-api" ]; then
    echo "🌐 API接続テスト中..."
    
    # APIサーバーが動作中か確認
    API_URL=${2:-"http://localhost:3000"}
    
    echo "  - API健康状態チェック ($API_URL)..."
    timeout 10s npm start -- health --url "$API_URL" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ API接続テスト成功"
    elif [ $? -eq 124 ]; then
        echo "⚠️  API接続テスト タイムアウト (APIサーバーが起動していない可能性があります)"
    else
        echo "⚠️  API接続テスト失敗 (APIサーバーが起動していない可能性があります)"
    fi
fi

echo ""
echo "🎉 テスト完了！"
echo ""
echo "🚀 CLIツールの使用を開始できます:"
echo "  npm start -- interactive     # インタラクティブモード"
echo "  npm start -- health          # API健康状態チェック"
echo "  npm start -- parallel        # 並列実行モード"
echo "  npm start -- schedule        # 定期実行モード" 