/**
 * AI-Shell Desktop — 前端逻辑 (橙白主题)
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // DOM
  const messagesEl = $('#messages');
  const inputEl = $('#user-input');
  const sendBtn = $('#btn-send');
  const sessionList = $('#session-list');
  const statusModel = $('#status-model');
  const statusTokens = $('#status-tokens');
  const statusDir = $('#status-dir');
  const settingsOverlay = $('#settings-overlay');

  let ws = null;
  let isGenerating = false;
  let currentAssistantMsg = null;
  let currentToolPanel = null;
  let toolCallCount = 0;
  let currentSession = 'default';
  let sessions = [];

  // ============================================================
  // WebSocket
  // ============================================================
  function connect() {
    updateDot('connecting');
    const port = location.port || '23789';
    ws = new WebSocket(`ws://localhost:${port}`);

    ws.onopen = () => {
      updateDot('connected');
      ws.send(JSON.stringify({ type: 'status' }));
      ws.send(JSON.stringify({ type: 'session-list' }));
    };

    ws.onmessage = (event) => {
      try { handleMessage(JSON.parse(event.data)); } catch (e) {}
    };

    ws.onclose = () => {
      updateDot('disconnected');
      setTimeout(connect, 3000);
    };

    ws.onerror = () => updateDot('disconnected');
  }

  function updateDot(state) {
    const dot = $('#status-dot');
    if (!dot) return;
    if (state === 'connected') dot.style.background = '#4a8c5c';
    else if (state === 'connecting') dot.style.background = '#e07b30';
    else dot.style.background = '#d14343';
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  }

  // ============================================================
  // 消息处理
  // ============================================================
  function handleMessage(msg) {
    switch (msg.type) {
      case 'status': updateStatus(msg.data); break;
      case 'token': handleToken(msg.data); break;
      case 'tool-start': handleToolStart(msg.data); break;
      case 'tool-end': handleToolEnd(msg.data); break;
      case 'done': handleDone(msg.data); break;
      case 'error': handleError(msg.message); break;
      case 'session-list': renderSessionList(msg.data); break;
      case 'session-loaded': handleSessionLoaded(msg.data); break;
      case 'session-cleared': newSession(); break;
      case 'model-changed': statusModel.textContent = msg.data.model; break;
      case 'save-path': $('#save-path-input').value = msg.data.path || ''; break;
      case 'folder-picked': $('#save-path-input').value = msg.data.path || ''; break;
    }
  }

  function updateStatus(data) {
    if (data.hasApiKey) {
      statusModel.textContent = data.model;
      statusDir.textContent = '● 已连接';
    } else {
      showSettings();
    }
  }

  function handleToken(token) {
    if (!currentAssistantMsg) return;
    const content = currentAssistantMsg.querySelector('.message-content');
    content.classList.remove('streaming-cursor');
    content.appendChild(document.createTextNode(token));
    scrollDown();
    content.classList.add('streaming-cursor');
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

  function handleDone(data) {
    if (currentAssistantMsg) {
      currentAssistantMsg.querySelector('.message-content').classList.remove('streaming-cursor');
    }
    isGenerating = false;
    sendBtn.classList.remove('generating');
    sendBtn.textContent = '▶';
    currentAssistantMsg = null;
    if (data && data.tokens) statusTokens.textContent = '~' + data.tokens + ' tokens';
    send({ type: 'session-list' });
  }

  function handleError(msg) {
    if (currentAssistantMsg) {
      const c = currentAssistantMsg.querySelector('.message-content');
      c.classList.remove('streaming-cursor');
      c.innerHTML += '<br><span style="color:var(--red);font-weight:500">发送错误: ' + escapeHtml(msg) + '</span>';
    }
    isGenerating = false;
    sendBtn.classList.remove('generating');
    sendBtn.textContent = '▶';
    currentAssistantMsg = null;
  }

  // ============================================================
  // 会话管理
  // ============================================================
  function renderSessionList(list) {
    sessions = list || [];
    sessionList.innerHTML = '';

    // 当前会话在顶部
    const curDiv = document.createElement('div');
    curDiv.className = 'session-item active';
    curDiv.textContent = currentSession === 'default' ? '新对话' : currentSession;
    curDiv.addEventListener('click', () => {
      if (isGenerating) return;
      currentSession = 'default';
      send({ type: 'session-clear' });
    });
    sessionList.appendChild(curDiv);

    // 已保存的会话（跳过当前正在看的）
    for (const s of sessions) {
      if (s.name === currentSession) continue;
      const item = document.createElement('div');
      item.className = 'session-item';
      item.textContent = s.name;

      const del = document.createElement('span');
      del.className = 'session-delete';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        item.remove();
      });
      item.appendChild(del);

      item.addEventListener('click', () => {
        if (isGenerating) return;
        currentSession = s.name;
        loadSession(s.name);
      });

      sessionList.appendChild(item);
    }
  }

  function loadSession(name) {
    messagesEl.innerHTML = '';
    send({ type: 'session-load', name: name });
  }

  function newSession() {
    currentSession = 'default';
    messagesEl.innerHTML = '';
    statusTokens.textContent = '';
    send({ type: 'session-list' });
  }

  function handleSessionLoaded(data) {
    messagesEl.innerHTML = '';
    for (const msg of data.messages) {
      if (msg.role === 'user') appendMessage('user', msg.content);
      else if (msg.role === 'assistant' && msg.content) appendMessage('assistant', msg.content);
      else if (msg.role === 'tool') appendToolResult(msg.name, msg.content);
    }
    currentSession = data.name;
    send({ type: 'session-list' });
    scrollDown();
  }

  // ============================================================
  // 消息发送
  // ============================================================
  function sendMessage() {
    if (isGenerating) { send({ type: 'stop' }); return; }

    const text = inputEl.value.trim();
    if (!text) return;

    appendMessage('user', text);
    inputEl.value = '';
    inputEl.style.height = 'auto';

    isGenerating = true;
    sendBtn.classList.add('generating');
    sendBtn.textContent = '■';
    toolCallCount = 0;

    currentAssistantMsg = appendMessage('assistant', '');
    currentAssistantMsg.querySelector('.message-content').classList.add('streaming-cursor');
    currentToolPanel = null;

    send({ type: 'chat', text: text });
  }

  // ============================================================
  // 消息渲染
  // ============================================================
  function appendMessage(role, content) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    const label = role === 'user' ? '你' : 'AI-Shell';
    div.innerHTML = `<div class="message-label">${label}</div>
      <div class="message-content">${content ? renderContent(content) : ''}</div>`;
    messagesEl.appendChild(div);
    scrollDown();
    return div;
  }

  function appendToolResult(name, content) {
    const panel = createToolPanel(name, {});
    panel.querySelector('.tool-status').textContent = '完成'; panel.querySelector('.tool-status').className = 'tool-status done';
    panel.querySelector('.tool-dot').className = 'tool-dot done';
    panel.querySelector('.tool-body').textContent = (content || '').slice(0, 500);
    messagesEl.appendChild(panel);
  }

  function renderContent(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const l = lang || 'code';
      const esc = code.trim().replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '&quot;');
      return `<div class="code-label-row"><span>${escapeHtml(l)}</span><button class="copy-btn" onclick="var t=this;t.textContent='已复制';t.classList.add('copied');navigator.clipboard.writeText('${esc}');setTimeout(function(){t.textContent='复制';t.classList.remove('copied')},2000)">复制</button></div><pre><code>${escapeHtml(code.trim())}</code></pre>`;
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
  function showSettings() {
    settingsOverlay.classList.remove('hidden');
    send({ type: 'get-save-path' });
  }
  function hideSettings() { settingsOverlay.classList.add('hidden'); }

  function saveSettings() {
    const apiKey = $('#api-key-input').value.trim();
    const model = $('#model-select').value;
    const savePath = $('#save-path-input').value.trim();
    if (apiKey) send({ type: 'set-api-key', key: apiKey });
    if (model) { send({ type: 'set-model', model: model }); statusModel.textContent = model; }
    if (savePath) send({ type: 'set-save-path', path: savePath });
    statusDir.textContent = '● 已连接';
    hideSettings();
  }

  // ============================================================
  // 事件
  // ============================================================
  function bindEvents() {
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });
    $('#btn-new-session').addEventListener('click', () => { if (!isGenerating) { send({ type: 'session-clear' }); newSession(); } });
    $('#btn-settings').addEventListener('click', showSettings);
    $('#btn-settings-save').addEventListener('click', saveSettings);
    $('#btn-settings-cancel').addEventListener('click', hideSettings);
    $('#btn-pick-path').addEventListener('click', () => send({ type: 'pick-folder' }));
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function scrollDown() {
    const c = $('#chat-container');
    requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; });
  }

  bindEvents();
  connect();
})();
