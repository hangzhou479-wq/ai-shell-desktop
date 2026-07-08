#!/bin/bash
# ============================================
# AI-Shell - Windows 打包脚本
# 参考文渊的 PyInstaller --onedir 模式
# ============================================
set -e

echo "========================================"
echo "  AI-Shell - Windows 打包构建"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist/AI-Shell-Windows"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 1. 复制核心文件
echo "[1/4] 复制项目文件..."
cp -r "$SCRIPT_DIR" "$DIST_DIR/ai-shell"
rm -rf "$DIST_DIR/ai-shell/node_modules" "$DIST_DIR/ai-shell/.github"
cp -r "$PROJECT_DIR/ai-shell-desktop" "$DIST_DIR/ai-shell-desktop"
rm -rf "$DIST_DIR/ai-shell-desktop/node_modules"

# 2. 复制依赖
echo "[2/4] 复制依赖包..."
cp -r "$SCRIPT_DIR/node_modules" "$DIST_DIR/ai-shell/"
cp -r "$PROJECT_DIR/ai-shell-desktop/node_modules" "$DIST_DIR/ai-shell-desktop/"

# 3. 便携 Node.js
echo "[3/4] 打包 Node.js 运行时..."
NODE_EXE="$PROJECT_DIR/ai-shell-desktop/node.exe"
if [ ! -f "$NODE_EXE" ]; then
    echo "  警告: 未找到 node.exe，请先下载到 ai-shell-desktop/"
    echo "  curl -L -o node-win.zip https://nodejs.org/dist/v20.19.0/node-v20.19.0-win-x64.zip"
    echo "  unzip node-win.zip"
    echo "  cp node-v20.19.0-win-x64/node.exe ai-shell-desktop/"
fi
cp "$NODE_EXE" "$DIST_DIR/ai-shell-desktop/node.exe" 2>/dev/null || echo "  跳过（node.exe 不存在）"

# 4. 创建启动器
echo "[4/4] 创建启动器..."
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

cp "$PROJECT_DIR/Windows/API-Key申请指南.md" "$DIST_DIR/"

# 5. 打包 ZIP
echo ""
echo "打包 ZIP..."
cd "$PROJECT_DIR/dist"
zip -r "AI-Shell-Windows.zip" "AI-Shell-Windows/" 2>/dev/null

echo ""
echo "========================================"
echo "  打包完成！"
echo "  ZIP: dist/AI-Shell-Windows.zip"
echo "========================================"
