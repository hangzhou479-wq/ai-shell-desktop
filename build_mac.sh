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
DIST_DIR="$SCRIPT_DIR/dist/AI-Shell-macOS"
rm -rf "$DIST_DIR" "$SCRIPT_DIR/dist/AI-Shell-macOS.dmg"
mkdir -p "$DIST_DIR"

# 1. 安装依赖
echo "[1/5] 安装依赖..."
cd "$SCRIPT_DIR"
rm -rf node_modules
npm install --omit=dev 2>/dev/null      # package.json (marked, pptxgenjs)
npm install ws --omit=dev 2>/dev/null   # desktop 需要 ws
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

# 4. 便携 Node.js
echo "[4/5] 打包 Node.js..."
NODE_BIN=""
for p in "/usr/local/bin/node" "/opt/homebrew/bin/node"; do
    [ -f "$p" ] && NODE_BIN="$p" && break
done
if [ -z "$NODE_BIN" ]; then
    echo "  下载便携 Node.js..."
    ARCH=$(uname -m)
    curl -sL "https://nodejs.org/dist/v20.19.0/node-v20.19.0-darwin-$ARCH.tar.gz" -o /tmp/node-mac.tar.gz
    tar -xzf /tmp/node-mac.tar.gz -C /tmp/
    NODE_BIN="/tmp/node-v20.19.0-darwin-$ARCH/bin/node"
fi
cp "$NODE_BIN" "$DIST_DIR/ai-shell-desktop/node"
chmod +x "$DIST_DIR/ai-shell-desktop/node"
echo "  node ready"

# 5. 启动器 + DMG
echo "[5/5] 创建 DMG..."
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

hdiutil create -volname "AI-Shell" \
    -srcfolder "$DIST_DIR" \
    -ov -format UDZO \
    "$SCRIPT_DIR/dist/AI-Shell-macOS.dmg"

echo ""
echo "========================================"
echo "  Done! dist/AI-Shell-macOS.dmg"
echo "========================================"
ls -lh "$SCRIPT_DIR/dist/AI-Shell-macOS.dmg"
