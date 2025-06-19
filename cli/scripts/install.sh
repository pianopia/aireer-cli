#!/bin/bash

# Aireer CLI インストールスクリプト

echo "🚀 Aireer CLI をインストールしています..."

# Node.jsバージョンチェック
NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
if [[ $NODE_VERSION == "not found" ]]; then
    echo "❌ Node.js が見つかりません。Node.js 18.0.0以上をインストールしてください。"
    exit 1
fi

# バージョン比較
REQUIRED_VERSION="18.0.0"
CURRENT_VERSION=$(echo $NODE_VERSION | sed 's/v//')

if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$CURRENT_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]]; then
    echo "❌ Node.js のバージョンが古すぎます。Node.js 18.0.0以上が必要です。現在のバージョン: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js バージョン確認完了: $NODE_VERSION"

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依存関係のインストールに失敗しました"
    exit 1
fi

# TypeScriptコンパイル
echo "🔨 TypeScriptをコンパイル中..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ TypeScriptのコンパイルに失敗しました"
    exit 1
fi

# 実行可能権限を付与
chmod +x dist/index.js

echo "✅ インストール完了！"
echo ""
echo "🎯 使用方法:"
echo "  npm start                     # 直接実行"
echo "  npm install -g .              # グローバルインストール"
echo "  npm link                      # 開発用リンク"
echo ""
echo "📚 ヘルプ:"
echo "  npm start -- --help           # コマンドヘルプ"
echo "  npm start -- interactive      # インタラクティブモード" 