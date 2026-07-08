/**
 * MCP JSON-RPC 2.0 客户端
 * 负责与 MCP Server 的高级通信（initialize, tools/list, tools/call）
 */
const StdioTransport = require('./transport');
const {
  PROTOCOL_VERSION,
  CLIENT_INFO,
  CLIENT_CAPABILITIES,
  METHODS,
  createRequest,
  createNotification,
} = require('./protocol');

class MCPClient {
  constructor(config) {
    this.config = config; // { command, args, env }
    this.transport = new StdioTransport(config.command, config.args, config.env);
    this.pendingRequests = new Map();
    this.serverCapabilities = null;
    this.serverInfo = null;
    this.initialized = false;
  }

  /**
   * 连接到 MCP Server
   * 执行完整的握手流程: start → initialize → initialized
   */
  async connect() {
    // 1. 启动子进程
    await this.transport.start();

    // 2. 注册消息处理器
    this.transport.onMessage((message) => {
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          reject(new Error(`MCP Error: ${message.error.message || JSON.stringify(message.error)}`));
        } else {
          resolve(message.result);
        }
      }
    });

    // 3. 发送 initialize
    const result = await this.sendRequest(METHODS.INITIALIZE, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: CLIENT_CAPABILITIES,
      clientInfo: CLIENT_INFO,
    });

    this.serverCapabilities = result.capabilities;
    this.serverInfo = result.serverInfo;

    // 4. 检查协议版本
    if (result.protocolVersion !== PROTOCOL_VERSION) {
      console.warn(`MCP Server 协议版本 ${result.protocolVersion} 与客户端 ${PROTOCOL_VERSION} 不同，可能存在兼容性问题`);
    }

    // 5. 发送 initialized 通知
    this.sendNotification(METHODS.INITIALIZED, {});
    this.initialized = true;

    return result;
  }

  /**
   * 发送请求并等待响应
   */
  sendRequest(method, params, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const request = createRequest(method, params);

      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`MCP 请求超时: ${method}`));
      }, timeout);

      this.pendingRequests.set(request.id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.transport.send(request);
    });
  }

  /**
   * 发送通知（不需要响应）
   */
  sendNotification(method, params) {
    this.transport.send(createNotification(method, params));
  }

  /**
   * 获取工具列表
   */
  async listTools() {
    if (!this.initialized) throw new Error('MCP Client 未初始化');
    const result = await this.sendRequest(METHODS.TOOLS_LIST, {});
    return result.tools || [];
  }

  /**
   * 调用工具
   */
  async callTool(toolName, args) {
    if (!this.initialized) throw new Error('MCP Client 未初始化');
    const result = await this.sendRequest(METHODS.TOOLS_CALL, {
      name: toolName,
      arguments: args,
    });

    // 处理结果
    if (result.isError) {
      throw new Error(`MCP 工具执行失败: ${result.content?.[0]?.text || '未知错误'}`);
    }

    // 提取文本内容
    const texts = (result.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    return texts || JSON.stringify(result.content);
  }

  /**
   * 获取资源列表
   */
  async listResources() {
    if (!this.initialized) throw new Error('MCP Client 未初始化');
    const result = await this.sendRequest(METHODS.RESOURCES_LIST, {});
    return result.resources || [];
  }

  /**
   * 读取资源
   */
  async readResource(uri) {
    if (!this.initialized) throw new Error('MCP Client 未初始化');
    return this.sendRequest(METHODS.RESOURCES_READ, { uri });
  }

  /**
   * Ping
   */
  async ping() {
    return this.sendRequest(METHODS.PING, {});
  }

  /**
   * 断开连接
   */
  async disconnect() {
    if (this.transport) {
      await this.transport.stop();
    }
    this.initialized = false;
  }
}

module.exports = MCPClient;
