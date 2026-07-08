#!/bin/bash
# ============================================
# AI-Shell - Windows 打包脚本
# 在 GitHub Actions (windows-latest + bash) 上运行
# ============================================
set -e

echo "========================================"
echo "  AI-Shell - Windows 打包构建"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist/AI-Shell-Windows"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 1. 安装依赖
echo "[1/5] 安装依赖..."
cd "$SCRIPT_DIR"
rm -rf node_modules
npm install --omit=dev 2>/dev/null
npm install ws --omit=dev 2>/dev/null
rm -rf node_modules/.bin 2>/dev/null

# 2. 复制文件
echo "[2/5] 复制文件..."
mkdir -p "$DIST_DIR/ai-shell" "$DIST_DIR/ai-shell-desktop"

cp -r "$SCRIPT_DIR/src"          "$DIST_DIR/ai-shell/"
cp -r "$SCRIPT_DIR/bin"          "$DIST_DIR/ai-shell/"
cp    "$SCRIPT_DIR/package.json" "$DIST_DIR/ai-shell/"

cp    "$SCRIPT_DIR/main.js"      "$DIST_DIR/ai-shell-desktop/"
cp -r "$SCRIPT_DIR/renderer"     "$DIST_DIR/ai-shell-desktop/"

# 3. 复制依赖
echo "[3/5] 复制依赖..."
cp -r "$SCRIPT_DIR/node_modules" "$DIST_DIR/ai-shell/"
cp -r "$SCRIPT_DIR/node_modules" "$DIST_DIR/ai-shell-desktop/"

# 4. 便携 Node.js (Windows)
echo "[4/5] 打包 Node.js..."
NODE_EXE="$SCRIPT_DIR/node.exe"
if [ ! -f "$NODE_EXE" ]; then
    echo "  下载便携 Node.js for Windows..."
    curl -sL "https://nodejs.org/dist/v20.19.0/node-v20.19.0-win-x64.zip" -o /tmp/node-win.zip
    unzip -o /tmp/node-win.zip -d /tmp/node-win/ 2>/dev/null
    NODE_EXE=$(find /tmp/node-win -name "node.exe" | head -1)
fi
if [ -f "$NODE_EXE" ]; then
    cp "$NODE_EXE" "$DIST_DIR/ai-shell-desktop/node.exe"
    echo "  node.exe ready"
else
    echo "  WARNING: node.exe not found, build will continue"
fi

# 5. 启动器 + ZIP
echo "[5/5] 创建启动器 + 打包..."

cat > "$DIST_DIR/AI-Shell.bat" << 'BATEOF'
@echo off
title AI-Shell
cd /d "%~dp0ai-shell-desktop"
if not exist "main.js" (
    echo Files not found. Please extract the whole ZIP first.
    pause
    exit /b 1
)
set AI_SHELL_NO_BROWSER=1
start /B .\node.exe main.js
timeout /t 3 /nobreak >nul
where msedge >nul 2>&1
if %errorlevel% equ 0 start msedge --app="http://localhost:23789" --window-size=1100,750 & goto :done
where chrome >nul 2>&1
if %errorlevel% equ 0 start chrome --app="http://localhost:23789" --window-size=1100,750 & goto :done
start "" http://localhost:23789
:done
echo AI-Shell running at http://localhost:23789
echo Close this window to stop.
pause >nul
taskkill /F /IM node.exe >nul 2>&1
BATEOF

# Windows 用 PowerShell Compress-Archive（不依赖 zip 命令）
cd "$SCRIPT_DIR/dist"
powershell -Command "Compress-Archive -Path 'AI-Shell-Windows' -DestinationPath 'AI-Shell-Windows.zip' -Force"

echo ""
echo "========================================"
echo "  Done! dist/AI-Shell-Windows.zip"
echo "========================================"
ls -lh "$SCRIPT_DIR/dist/AI-Shell-Windows.zip"
