#!/bin/bash
# ============================================
# AI-Shell - macOS 打包脚本
# ============================================
set -e

echo "========================================"
echo "  AI-Shell - macOS 打包构建"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist/AI-Shell-macOS"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 1. 安装依赖
echo "[1/5] 安装依赖..."
cd "$SCRIPT_DIR" && rm -rf node_modules && npm install --omit=dev 2>/dev/null
cd "$PROJECT_DIR/ai-shell-desktop"
rm -rf node_modules/.bin 2>/dev/null  # 清理 Electron 残留
npm install --omit=dev 2>/dev/null
rm -rf node_modules/.bin 2>/dev/null

# 2. 复制文件
echo "[2/5] 复制项目文件..."
cp -r "$SCRIPT_DIR" "$DIST_DIR/ai-shell"
rm -rf "$DIST_DIR/ai-shell/.github" "$DIST_DIR/ai-shell/build_mac.sh" "$DIST_DIR/ai-shell/build_win.sh"
cp -r "$PROJECT_DIR/ai-shell-desktop" "$DIST_DIR/ai-shell-desktop"
rm -rf "$DIST_DIR/ai-shell-desktop/.bin" "$DIST_DIR/ai-shell-desktop/node_modules/.bin"
rm -rf "$DIST_DIR/ai-shell-desktop/native" "$DIST_DIR/ai-shell-desktop/AI-Shell.app"

# 3. 复制依赖
echo "[3/5] 复制依赖包..."
cp -r "$SCRIPT_DIR/node_modules" "$DIST_DIR/ai-shell/"
cp -r "$PROJECT_DIR/ai-shell-desktop/node_modules" "$DIST_DIR/ai-shell-desktop/"
rm -rf "$DIST_DIR/ai-shell-desktop/node_modules/.bin"

# 4. 便携 Node.js
echo "[4/5] 打包 Node.js 运行时..."
NODE_BIN=""
for p in "$PROJECT_DIR/ai-shell-desktop/node" "/usr/local/bin/node" "/opt/homebrew/bin/node"; do
    [ -f "$p" ] && NODE_BIN="$p" && break
done
if [ -z "$NODE_BIN" ]; then
    echo "  下载便携 Node.js..."
    curl -sL "https://nodejs.org/dist/v20.19.0/node-v20.19.0-darwin-arm64.tar.gz" -o /tmp/node-mac.tar.gz
    tar -xzf /tmp/node-mac.tar.gz -C /tmp/
    NODE_BIN="/tmp/node-v20.19.0-darwin-arm64/bin/node"
fi
cp "$NODE_BIN" "$DIST_DIR/ai-shell-desktop/node"
chmod +x "$DIST_DIR/ai-shell-desktop/node"
echo "  node: $(file "$DIST_DIR/ai-shell-desktop/node" | head -c 50)"

# 5. 启动器 + 文档
echo "[5/5] 创建启动器..."
cat > "$DIST_DIR/AI-Shell.command" << 'LAUNCHER'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/ai-shell-desktop"
AI_SHELL_NO_BROWSER=1 ./node main.js &
sleep 2
open "http://localhost:23789"
echo "AI-Shell started! Close this window to stop."
read -p "Press Enter to stop..."
kill %1 2>/dev/null
LAUNCHER
chmod +x "$DIST_DIR/AI-Shell.command"

cp "$PROJECT_DIR/MacBook/API-Key申请指南.md" "$DIST_DIR/"

# 打包 DMG
echo ""
echo "Packaging DMG..."
hdiutil create -volname "AI-Shell" \
    -srcfolder "$DIST_DIR" \
    -ov -format UDZO \
    "$PROJECT_DIR/dist/AI-Shell-macOS.dmg"

echo ""
echo "========================================"
echo "  Done! dist/AI-Shell-macOS.dmg"
echo "========================================"
ls -lh "$PROJECT_DIR/dist/AI-Shell-macOS.dmg"
