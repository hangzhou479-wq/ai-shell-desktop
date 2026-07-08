/**
 * AI-Shell Desktop — Web Server 主进程
 * 启动本地 HTTP + WebSocket 服务，自动打开浏览器
 * 加载 ai-shell 核心模块处理聊天请求
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// ============================================================
// 加载 ai-shell 核心模块
// ============================================================
const aiShellPath = path.join(__dirname, '..', 'ai-shell', 'src');
const { ToolRegistry } = require(path.join(aiShellPath, 'tools', 'registry'));
const { createDispatcher } = require(path.join(aiShellPath, 'tools', 'dispatcher'));
const { runToolCallingLoop } = require(path.join(aiShellPath, 'api', 'chat'));
const { load: loadConfig } = require(path.join(aiShellPath, 'config', 'loader'));
const { getApiKey } = require(path.join(aiShellPath, 'config', 'api-key'));
const HistoryManager = require(path.join(aiShellPath, 'utils', 'history'));
const platform = require(path.join(aiShellPath, 'utils', 'platform'));
const MCPManager = require(path.join(aiShellPath, 'mcp', 'manager'));
const constants = require(path.join(aiShellPath, 'constants'));

// ============================================================
// 全局状态
// ============================================================
let config = null;
let registry = null;
let dispatch = null;
let mcpManager = null;
let currentHistory = null;

// ============================================================
// MIME 类型映射
// ============================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ============================================================
// HTTP 服务器 — 静态文件服务
// ============================================================
const rendererDir = path.join(__dirname, 'renderer');

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(rendererDir, filePath);

  // 安全检查：不允许访问 renderer 目录外的文件
  if (!filePath.startsWith(rendererDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// ============================================================
// WebSocket 服务器 — 聊天通信
// ============================================================
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('客户端已连接');

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

    switch (msg.type) {
      case 'chat': await handleChat(ws, msg); break;
      case 'stop': handleStop(ws); break;
      case 'status': handleStatus(ws); break;
      case 'set-api-key': handleSetApiKey(ws, msg.key); break;
      case 'set-model': handleSetModel(ws, msg.model); break;
      case 'session-clear': handleSessionClear(ws); break;
      case 'session-list': handleSessionList(ws); break;
      case 'session-load': handleSessionLoad(ws, msg.name); break;
      case 'get-tools': handleGetTools(ws); break;
      case 'set-save-path': handleSetSavePath(ws, msg.path); break;
      case 'get-save-path': handleGetSavePath(ws); break;
      case 'pick-folder': handlePickFolder(ws); break;
    }
  });

  // 发送当前状态 + 已有消息
  sendJson(ws, { type: 'status', data: getStatus() });
  if (currentHistory && currentHistory.getMessages().length > 1) {
    sendJson(ws, {
      type: 'session-loaded',
      data: {
        name: currentHistory.sessionName,
        messages: currentHistory.getMessages(),
      },
    });
  }
  sendJson(ws, { type: 'session-list', data: HistoryManager.listSessions() });
});

// ============================================================
// 处理器
// ============================================================
async function handleChat(ws, msg) {
  if (!config?.apiKey) {
    sendJson(ws, { type: 'error', message: '请先配置 DeepSeek API Key' });
    return;
  }

  if (!currentHistory) {
    currentHistory = new HistoryManager('default');
    currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);
  }

  // 第一条消息自动命名会话（加时间戳防冲突）
  if (currentHistory.sessionName === 'default' && currentHistory.getMessages().length <= 2) {
    const base = msg.text.replace(/\n/g, ' ').slice(0, 25).trim();
    const ts = Date.now().toString(36).slice(-4);
    currentHistory.sessionName = base + '-' + ts;
    currentHistory.metadata.createdAt = new Date().toISOString();
  }

  currentHistory.addUserMessage(msg.text);
  const maxCtx = constants.MAX_CONTEXT_TOKENS - constants.RESERVE_OUTPUT_TOKENS;
  currentHistory.trim(maxCtx);

  const tools = registry.getToolDefinitions();

  try {
    await runToolCallingLoop(config, currentHistory, {
      tools,
      dispatchTool: dispatch,
      maxIterations: 10,
      onToken: (token) => sendJson(ws, { type: 'token', data: token }),
      onToolStart: (toolName, args) => sendJson(ws, { type: 'tool-start', data: { toolName, args } }),
      onToolEnd: (toolName, err) => sendJson(ws, { type: 'tool-end', data: { toolName, error: err?.message } }),
    });

    const { estimateMessagesTokens } = require(path.join(aiShellPath, 'utils', 'token'));
    const tokens = estimateMessagesTokens(currentHistory.getMessages());
    sendJson(ws, { type: 'done', data: { tokens } });
    currentHistory.save();
  } catch (err) {
    sendJson(ws, { type: 'error', message: err.message });
  }
}

function handleStop(ws) {
  // 流中断由客户端控制
}

function handleStatus(ws) {
  sendJson(ws, { type: 'status', data: getStatus() });
}

function handleSetApiKey(ws, key) {
  if (key && key.trim()) {
    config.apiKey = key.trim();
    const configDir = platform.getConfigDir();
    platform.ensureDir(configDir);
    fs.writeFileSync(path.join(configDir, 'key'), key.trim(), { mode: 0o600 });
    sendJson(ws, { type: 'api-key-saved', data: {} });
  }
}

function handleSetModel(ws, model) {
  config.model = model;
  sendJson(ws, { type: 'model-changed', data: { model } });
}

function handleSessionClear(ws) {
  // 保存当前会话到磁盘
  if (currentHistory) {
    currentHistory.save();
  }
  // 创建新会话
  currentHistory = new HistoryManager('default');
  currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);
  config.sessionName = 'default';
  // 推送更新
  sendJson(ws, { type: 'session-cleared', data: {} });
  sendJson(ws, { type: 'session-list', data: HistoryManager.listSessions() });
}

function handleSessionList(ws) {
  const sessions = HistoryManager.listSessions();
  sendJson(ws, { type: 'session-list', data: sessions });
}

function handleSessionLoad(ws, name) {
  if (currentHistory) currentHistory.save();
  currentHistory = new HistoryManager(name);
  currentHistory.load();
  if (!currentHistory.getMessages().length) {
    currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);
  }
  config.sessionName = name;
  sendJson(ws, { type: 'session-loaded', data: { name, messages: currentHistory.getMessages() } });
}

function handleGetTools(ws) {
  sendJson(ws, { type: 'tools-list', data: registry?.listNames() || [] });
}

function handleSetSavePath(ws, savePath) {
  if (savePath && savePath.trim()) {
    config.defaultSavePath = savePath.trim();
    sendJson(ws, { type: 'save-path-set', data: { path: savePath.trim() } });
  }
}

function handleGetSavePath(ws) {
  sendJson(ws, { type: 'save-path', data: { path: config?.defaultSavePath || '' } });
}

function handlePickFolder(ws) {
  const { execSync } = require('child_process');
  try {
    let folder = '';
    if (process.platform === 'darwin') {
      const script = 'POSIX path of (choose folder with prompt "选择默认保存路径")';
      folder = execSync(`osascript -e '${script}'`, { encoding: 'utf8', timeout: 60000 }).trim();
    }
    if (folder) {
      sendJson(ws, { type: 'folder-picked', data: { path: folder } });
    }
  } catch (e) {
    // 用户取消了选择
  }
}

function getStatus() {
  return {
    hasApiKey: !!config?.apiKey,
    model: config?.model || 'deepseek-chat',
    sessionName: currentHistory?.sessionName || 'default',
    toolCount: registry?.count() || 0,
  };
}

function sendJson(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

// ============================================================
// 初始化
// ============================================================
async function init() {
  config = loadConfig();
  const { key } = getApiKey(config);
  if (key) config.apiKey = key;

  // 桌面模式：不需要每次确认（用户已通过 UI 发起操作）
  config.requireConfirmation = false;

  registry = new ToolRegistry();
  dispatch = createDispatcher(registry, config);

  mcpManager = new MCPManager(registry);
  try { await mcpManager.startAll(); } catch (e) { /* ignore */ }

  currentHistory = new HistoryManager('default');
  currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);

  // 自动恢复上一次会话
  const sessions = HistoryManager.listSessions();
  if (sessions.length > 0) {
    const last = sessions[0]; // 按时间排序，第一个就是最新的
    currentHistory = new HistoryManager(last.name);
    if (currentHistory.load()) {
      config.sessionName = last.name;
      console.log('已恢复会话:', last.name, '(' + last.messages + ' 条消息)');
    } else {
      currentHistory = new HistoryManager('default');
      currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);
    }
  }
}

// ============================================================
// 启动
// ============================================================
const PORT = process.env.AI_SHELL_PORT || 23789;

init().then(() => {
  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   AI-Shell Desktop v1.1                  ║');
    console.log('║   已在浏览器中打开 → ' + url + '        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    // 自动打开浏览器（除非被 Electron 或原生 App 调用）
    if (!process.env.AI_SHELL_NO_BROWSER && !process.env.AI_SHELL_ELECTRON) {
      const { exec } = require('child_process');
      const platform = process.platform;
      const openCmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCmd} ${url}`);
    }
  });
});
