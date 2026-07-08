/**
 * 默认配置值
 */
module.exports = {
  // API 配置
  apiKey: '',
  apiBaseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  maxTokens: 8192,

  // 请求配置
  timeout: 120000,
  maxRetries: 3,

  // 终端配置
  theme: 'dark',
  showLineNumbers: true,

  // 会话配置
  maxHistoryLength: 100,
  autoSaveSession: true,
  sessionName: 'default',

  // MCP 配置
  mcpEnabled: true,

  // 工具配置
  requireConfirmation: true,
  allowedCommands: [],
  blockedCommands: [],

  // 代理配置
  proxy: '',
};
