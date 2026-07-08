/**
 * MCP (Model Context Protocol) 协议定义
 * 基于 MCP 2025-11-25 版本
 */

const PROTOCOL_VERSION = '2025-11-25';

const CLIENT_INFO = {
  name: 'ai-shell',
  version: '1.0.0',
};

const CLIENT_CAPABILITIES = {
  tools: {},
  roots: {
    listChanged: true,
  },
};

// JSON-RPC 2.0 消息类型
const JSONRPC = '2.0';

// MCP 标准方法
const METHODS = {
  // 生命周期
  INITIALIZE: 'initialize',
  INITIALIZED: 'notifications/initialized',
  PING: 'ping',

  // 工具
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  TOOLS_LIST_CHANGED: 'notifications/tools/list_changed',

  // 资源
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_LIST_CHANGED: 'notifications/resources/list_changed',

  // 提示
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',
  PROMPTS_LIST_CHANGED: 'notifications/prompts/list_changed',
};

/**
 * 创建 JSON-RPC 请求
 */
function createRequest(method, params) {
  return {
    jsonrpc: JSONRPC,
    id: generateId(),
    method,
    params: params || {},
  };
}

/**
 * 创建 JSON-RPC 通知（无 id，不需要响应）
 */
function createNotification(method, params) {
  return {
    jsonrpc: JSONRPC,
    method,
    params: params || {},
  };
}

/**
 * 创建 JSON-RPC 响应
 */
function createResponse(id, result) {
  return {
    jsonrpc: JSONRPC,
    id,
    result,
  };
}

/**
 * 创建 JSON-RPC 错误响应
 */
function createErrorResponse(id, code, message) {
  return {
    jsonrpc: JSONRPC,
    id,
    error: {
      code,
      message,
    },
  };
}

/**
 * 生成消息 ID
 */
function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * 解析 JSON-RPC 消息
 */
function parseMessage(data) {
  try {
    const msg = JSON.parse(data);
    if (msg.jsonrpc !== JSONRPC) return null;
    return msg;
  } catch (err) {
    return null;
  }
}

module.exports = {
  PROTOCOL_VERSION,
  CLIENT_INFO,
  CLIENT_CAPABILITIES,
  JSONRPC,
  METHODS,
  createRequest,
  createNotification,
  createResponse,
  createErrorResponse,
  parseMessage,
};
