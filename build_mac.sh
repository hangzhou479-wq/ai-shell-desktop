#!/bin/bash
set -e

echo "========================================"
echo "  AI Shell - macOS 打包 (electron-builder)"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 1. 安装依赖
echo "[1/4] 安装依赖..."
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install 2>/dev/null

# 2. 构建 .app（但不打包 dmg）
echo "[2/4] electron-builder 构建 .app..."
npx electron-builder --mac --dir --publish=never

# 3. 签名 .app
APP_PATH="dist/mac/AI Shell.app"
if [ -d "$APP_PATH" ]; then
    echo "[3/4] 本地自签名..."
    codesign --force --deep --sign - "$APP_PATH"
else
    echo "⚠️ 未找到 $APP_PATH，跳过签名"
fi

# 4. 打包 dmg
echo "[4/4] 打包 DMG..."
if [ -d "$APP_PATH" ]; then
    hdiutil create -volname "AI Shell" -srcfolder "dist/mac" -ov -format UDZO "dist/AI-Shell-macOS.dmg"
    echo "✅ DMG 已生成: dist/AI-Shell-macOS.dmg"
else
    echo "❌ .app 不存在，无法打包 DMG"
    exit 1
fi

echo "========================================"
echo "  完成"
ls -lh dist/*.dmg
