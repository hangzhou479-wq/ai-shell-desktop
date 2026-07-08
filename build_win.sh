#!/bin/bash
# ============================================
# AI Shell - Windows 打包 (electron-builder)
# ============================================
set -e

echo "========================================"
echo "  AI Shell - Windows 打包"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 1. 安装依赖
echo "[1/3] 安装依赖..."
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install 2>/dev/null

# 2. 构建
echo "[2/3] electron-builder 打包 (Windows)..."
npx electron-builder --win --publish=never 2>&1 | tail -5

# 3. 输出
echo ""
echo "[3/3] 完成"
echo "========================================"
ls -lh dist/*.exe 2>/dev/null || ls -lh dist/win-unpacked/*.exe 2>/dev/null || echo "查看 dist/ 目录"
