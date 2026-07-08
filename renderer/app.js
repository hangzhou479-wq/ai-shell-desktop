/**
 * AI Shell — 前端交互逻辑 (Electron IPC 版)
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const messagesEl = $('#messages');
  const inputEl = $('#user-input');
  const sendBtn = $('#btn-send');
  const sessionList = $('#session-list');
  const statusModel = $('#status-model');
  const statusTokens = $('#status-tokens');
  const statusDir = $('#status-dir');
  const settingsOverlay = $('#settings-overlay');

  let isGenerating = false;
  let currentAssistantMsg = null;
  let currentToolPanel = null;
  let toolCallCount = 0;
  let currentSession = 'default';

  // ============================================================
  // 初始化
  // ============================================================
  async function init() {
    try {
      const s = await window.aiShell.getStatus();
      if (s.hasApiKey) { statusModel.textContent = s.model; statusDir.textContent = '● 已连接'; }
      else { showSettings(); }
    } catch (e) {}

    loadSessionList();
    bindEvents();
  }

  function bindEvents() {
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    $('#btn-new-session').addEventListener('click', async () => {
      if (isGenerating) return;
      await window.aiShell.clearSession();
      messagesEl.innerHTML = '';
      statusTokens.textContent = '';
      loadSessionList();
    });

    $('#btn-settings').addEventListener('click', showSettings);
    $('#btn-settings-save').addEventListener('click', saveSettings);
    $('#btn-settings-cancel').addEventListener('click', hideSettings);
    $('#btn-pick-path').addEventListener('click', async () => {
      const folder = await window.aiShell.pickFolder();
      if (folder) $('#save-path-input').value = folder;
    });
  }

  // ============================================================
  // 消息发送
  // ============================================================
  async function sendMessage() {
    if (isGenerating) return;
    const text = inputEl.value.trim();
    if (!text) return;

    appendMessage('user', text);
    inputEl.value = '';
    inputEl.style.height = 'auto';

    isGenerating = true;
    sendBtn.classList.add('generating');
    sendBtn.textContent = '■';
    toolCallCount = 0;

    // 注册事件
    window.aiShell.removeAllListeners();
    window.aiShell.onToken(handleToken);
    window.aiShell.onToolStart(handleToolStart);
    window.aiShell.onToolEnd(handleToolEnd);

    currentAssistantMsg = appendMessage('assistant', '');
    currentAssistantMsg.querySelector('.message-content').classList.add('streaming-cursor');
    currentToolPanel = null;

    const result = await window.aiShell.sendMessage(text);

    if (currentAssistantMsg) {
      currentAssistantMsg.querySelector('.message-content').classList.remove('streaming-cursor');
    }

    if (result.error) {
      if (currentAssistantMsg) {
        currentAssistantMsg.querySelector('.message-content').innerHTML +=
          '<br><span style="color:var(--red);font-weight:500">' + escapeHtml(result.error) + '</span>';
      }
    } else if (result.tokens) {
      statusTokens.textContent = '~' + result.tokens + ' tokens';
    }

    isGenerating = false;
    sendBtn.classList.remove('generating');
    sendBtn.textContent = '▶';
    currentAssistantMsg = null;
    loadSessionList();
  }

  // ============================================================
  // 事件处理
  // ============================================================
  function handleToken(token) {
    if (!currentAssistantMsg) return;
    const c = currentAssistantMsg.querySelector('.message-content');
    c.classList.remove('streaming-cursor');
    c.appendChild(document.createTextNode(token));
    scrollDown();
    c.classList.add('streaming-cursor');
  }

  function handleToolStart(data) {
    toolCallCount++;
    if (currentToolPanel) {
      currentToolPanel.classList.remove('expanded');
      const ts = currentToolPanel.querySelector('.tool-status');
      ts.textContent = '完成'; ts.className = 'tool-status done';
      const dot = currentToolPanel.querySelector('.tool-dot');
      dot.className = 'tool-dot done';
    }
    currentToolPanel = createToolPanel(data.toolName, data.args);
    messagesEl.appendChild(currentToolPanel);
    scrollDown();
  }

  function handleToolEnd(data) {
    if (!currentToolPanel) return;
    const ts = currentToolPanel.querySelector('.tool-status');
    const dot = currentToolPanel.querySelector('.tool-dot');
    if (data.error) {
      ts.textContent = '失败'; ts.className = 'tool-status error';
      dot.className = 'tool-dot error';
    } else {
      ts.textContent = '完成'; ts.className = 'tool-status done';
      dot.className = 'tool-dot done';
    }
  }

  // ============================================================
  // 会话管理
  // ============================================================
  async function loadSessionList() {
    const sessions = await window.aiShell.listSessions();
    sessionList.innerHTML = '';

    const cur = document.createElement('div');
    cur.className = 'session-item active';
    cur.textContent = currentSession === 'default' ? '新对话' : currentSession;
    cur.addEventListener('click', async () => {
      if (isGenerating) return;
      await window.aiShell.clearSession();
      currentSession = 'default';
      messagesEl.innerHTML = '';
      loadSessionList();
    });
    sessionList.appendChild(cur);

    for (const s of (sessions || [])) {
      if (s.name === currentSession) continue;
      const item = document.createElement('div');
      item.className = 'session-item';
      item.textContent = s.name;
      item.addEventListener('click', async () => {
        if (isGenerating) return;
        currentSession = s.name;
        const data = await window.aiShell.loadSession(s.name);
        messagesEl.innerHTML = '';
        for (const m of data.messages) {
          if (m.role === 'user') appendMessage('user', m.content);
          else if (m.role === 'assistant' && m.content) appendMessage('assistant', m.content);
        }
        loadSessionList();
      });
      sessionList.appendChild(item);
    }
  }

  // ============================================================
  // 消息渲染
  // ============================================================
  function appendMessage(role, content) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    div.innerHTML = `<div class="message-label">${role === 'user' ? '你' : 'AI Shell'}</div>
      <div class="message-content">${content ? renderContent(content) : ''}</div>`;
    messagesEl.appendChild(div);
    scrollDown();
    return div;
  }

  function renderContent(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const l = lang || 'code';
      const esc = code.trim().replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      return `<div class="code-label-row"><span>${escapeHtml(l)}</span><button class="copy-btn" onclick="navigator.clipboard.writeText('${esc}');this.textContent='已复制';this.classList.add('copied');setTimeout(()=>{this.textContent='复制';this.classList.remove('copied')},2000)">复制</button></div><pre><code>${escapeHtml(code.trim())}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function createToolPanel(toolName, args) {
    const panel = document.createElement('div');
    panel.className = 'tool-panel';
    const preview = typeof args === 'object' ? JSON.stringify(args).slice(0, 80) : String(args || '').slice(0, 80);
    panel.innerHTML = `<div class="tool-header">
      <span class="tool-dot running"></span><span class="tool-name">${escapeHtml(toolName)}</span>
      <span class="tool-args">${escapeHtml(preview)}</span><span class="tool-status running">运行中</span></div>
      <div class="tool-body"></div>`;
    panel.querySelector('.tool-header').addEventListener('click', () => panel.classList.toggle('expanded'));
    return panel;
  }

  // ============================================================
  // 设置
  // ============================================================
  async function showSettings() {
    settingsOverlay.classList.remove('hidden');
    const s = await window.aiShell.getSettings();
    if (s.defaultSavePath) $('#save-path-input').value = s.defaultSavePath;
    $('#model-select').value = s.model || 'deepseek-chat';
  }
  function hideSettings() { settingsOverlay.classList.add('hidden'); }

  async function saveSettings() {
    const apiKey = $('#api-key-input').value.trim();
    const model = $('#model-select').value;
    const savePath = $('#save-path-input').value.trim();
    await window.aiShell.saveSettings({ apiKey, model, savePath });
    statusModel.textContent = model;
    statusDir.textContent = '● 已连接';
    hideSettings();
  }

  // ============================================================
  // 辅助
  // ============================================================
  function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
  function scrollDown() { const c = $('#chat-container'); requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; }); }

  init();
})();
