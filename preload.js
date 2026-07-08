/**
 * AI Shell - Preload 安全桥接
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aiShell', {
  // 聊天
  sendMessage: (text) => ipcRenderer.invoke('chat:send', text),

  // 事件监听
  onToken: (cb) => {
    ipcRenderer.on('chat:token', (_, t) => cb(t));
  },
  onToolStart: (cb) => {
    ipcRenderer.on('tool:start', (_, d) => cb(d));
  },
  onToolEnd: (cb) => {
    ipcRenderer.on('tool:end', (_, d) => cb(d));
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('chat:token');
    ipcRenderer.removeAllListeners('tool:start');
    ipcRenderer.removeAllListeners('tool:end');
  },

  // 状态
  getStatus: () => ipcRenderer.invoke('status'),

  // 会话
  listSessions: () => ipcRenderer.invoke('session:list'),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  loadSession: (name) => ipcRenderer.invoke('session:load', name),
  saveSession: () => ipcRenderer.invoke('session:list'), // 存盘已在上次 chat 完成时做了

  // 设置
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
  getSettings: () => ipcRenderer.invoke('settings:get'),

  // 系统
  pickFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
