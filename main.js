/**
 * AI Shell - Electron 主进程
 * BrowserWindow 直接加载 renderer/index.html
 * 通过 IPC 通信，不启动 HTTP 服务器
 */
const { app, BrowserWindow, ipcMain, shell: electronShell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ---- 加载 ai-shell 核心 ----
const { ToolRegistry } = require('./src/tools/registry');
const { createDispatcher } = require('./src/tools/dispatcher');
const { runToolCallingLoop } = require('./src/api/chat');
const { load: loadConfig } = require('./src/config/loader');
const { getApiKey } = require('./src/config/api-key');
const HistoryManager = require('./src/utils/history');
const platform = require('./src/utils/platform');
const MCPManager = require('./src/mcp/manager');
const constants = require('./src/constants');

let config, registry, dispatch, mcpManager, currentHistory, mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 750,
    minWidth: 800, minHeight: 500,
    title: 'AI Shell',
    backgroundColor: '#faf8f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

async function init() {
  platform.ensureDir(platform.getConfigDir());
  platform.ensureDir(platform.getSessionsDir());
  config = loadConfig();
  const { key } = getApiKey(config);
  if (key) config.apiKey = key;
  config.requireConfirmation = false;
  registry = new ToolRegistry();
  dispatch = createDispatcher(registry, config);
  mcpManager = new MCPManager(registry);
  try { await mcpManager.startAll(); } catch (e) {}
  currentHistory = new HistoryManager('default');
  currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);
  const sessions = HistoryManager.listSessions();
  if (sessions.length > 0) {
    currentHistory = new HistoryManager(sessions[0].name);
    if (!currentHistory.load()) {
      currentHistory = new HistoryManager('default');
      currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);
    }
  }
}

function setupIPC() {
  ipcMain.handle('chat:send', async (_, text) => {
    if (!config?.apiKey) return { error: '请先配置 DeepSeek API Key' };
    if (currentHistory.sessionName === 'default' && currentHistory.getMessages().length <= 2) {
      const ts = Date.now().toString(36).slice(-4);
      currentHistory.sessionName = text.replace(/\n/g, ' ').slice(0, 25).trim() + '-' + ts;
    }
    currentHistory.addUserMessage(text);
    currentHistory.trim(constants.MAX_CONTEXT_TOKENS - constants.RESERVE_OUTPUT_TOKENS);

    try {
      await runToolCallingLoop(config, currentHistory, {
        tools: registry.getToolDefinitions(),
        dispatchTool: dispatch,
        maxIterations: 10,
        onToken: t => mainWindow?.webContents.send('chat:token', t),
        onToolStart: (name, args) => mainWindow?.webContents.send('tool:start', { toolName: name, args }),
        onToolEnd: (name, err) => mainWindow?.webContents.send('tool:end', { toolName: name, error: err?.message }),
      });
      const { estimateMessagesTokens } = require('./src/utils/token');
      const tokens = estimateMessagesTokens(currentHistory.getMessages());
      currentHistory.save();
      return { tokens };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('status', () => ({
    hasApiKey: !!config?.apiKey,
    model: config?.model || 'deepseek-chat',
    toolCount: registry?.count() || 0,
  }));

  ipcMain.handle('session:list', () => HistoryManager.listSessions());

  ipcMain.handle('session:clear', () => {
    currentHistory?.save();
    currentHistory = new HistoryManager('default');
    currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);
    return HistoryManager.listSessions();
  });

  ipcMain.handle('session:load', (_, name) => {
    currentHistory?.save();
    currentHistory = new HistoryManager(name);
    currentHistory.load();
    if (!currentHistory.getMessages().length)
      currentHistory.setSystemPrompt(constants.SYSTEM_PROMPT);
    return { name, messages: currentHistory.getMessages() };
  });

  ipcMain.handle('settings:save', (_, { apiKey, model, savePath }) => {
    if (apiKey) {
      config.apiKey = apiKey;
      platform.ensureDir(platform.getConfigDir());
      fs.writeFileSync(path.join(platform.getConfigDir(), 'key'), apiKey, { mode: 0o600 });
    }
    if (model) config.model = model;
    if (savePath) config.defaultSavePath = savePath;
    return { success: true };
  });

  ipcMain.handle('settings:get', () => ({
    hasApiKey: !!config?.apiKey,
    model: config?.model || 'deepseek-chat',
    defaultSavePath: config?.defaultSavePath || '',
  }));

  ipcMain.handle('dialog:openFolder', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return r.canceled ? '' : r.filePaths[0];
  });

  ipcMain.handle('shell:openExternal', (_, url) => electronShell.openExternal(url));
}

app.whenReady().then(async () => {
  await init();
  setupIPC();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  mcpManager?.stopAll();
  if (process.platform !== 'darwin') app.quit();
});
