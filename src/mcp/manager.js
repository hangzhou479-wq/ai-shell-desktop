/**
 * MCP Server 生命周期管理器
 * 负责：
 * - 读取 mcp.json 配置
 * - 启动/停止 MCP Server 子进程
 * - 发现并注册 MCP 工具
 * - 管理多个 MCP Server
 */
const fs = require('fs');
const path = require('path');
const MCPClient = require('./client');
const platform = require('../utils/platform');
const colors = require('../terminal/colors');

class MCPManager {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
    this.clients = new Map(); // serverName -> MCPClient
    this.toolMap = new Map();  // toolName -> { client, serverName }
  }

  /**
   * 从 mcp.json 加载并启动所有 MCP Server
   */
  async startAll() {
    const configPath = platform.getMcpConfigPath();

    if (!fs.existsSync(configPath)) {
      // 创建默认 mcp.json
      this.createDefaultConfig();
      return;
    }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
      console.log(colors.warn(`MCP 配置文件解析失败: ${configPath}`));
      return;
    }

    const servers = config.mcpServers || {};

    for (const [name, serverConfig] of Object.entries(servers)) {
      if (serverConfig.disabled) continue;

      try {
        await this.startServer(name, serverConfig);
      } catch (err) {
        console.log(colors.warn(`MCP Server "${name}" 启动失败: ${err.message}`));
        if (process.env.DEBUG) {
          console.error(err);
        }
      }
    }

    if (this.clients.size > 0) {
      console.log(colors.dim(`已启动 ${this.clients.size} 个 MCP Server，共注册 ${this.toolMap.size} 个工具`));
    }
  }

  /**
   * 启动一个 MCP Server
   */
  async startServer(name, config) {
    const client = new MCPClient(config);

    try {
      const initResult = await client.connect();

      // 获取工具列表
      if (client.serverCapabilities?.tools) {
        const tools = await client.listTools();

        for (const tool of tools) {
          // 注册到全局工具注册表
          const handler = async (toolName, args) => {
            return client.callTool(toolName, args);
          };

          this.toolRegistry.registerMCPTool(tool, handler);
          this.toolMap.set(tool.name, { client, serverName: name });
        }
      }

      this.clients.set(name, client);

      if (initResult.serverInfo) {
        const info = initResult.serverInfo;
        console.log(colors.dim(`  MCP: ${name} (${info.name} v${info.version})`));
      }

      return client;
    } catch (err) {
      // 启动失败时清理
      try { await client.disconnect(); } catch (e) { /* ignore */ }
      throw err;
    }
  }

  /**
   * 停止所有 MCP Server
   */
  async stopAll() {
    for (const [name, client] of this.clients) {
      try {
        await client.disconnect();
      } catch (err) {
        // ignore
      }
    }

    this.clients.clear();
    this.toolMap.clear();
    this.toolRegistry.clearMCPTools();
  }

  /**
   * 停止单个 MCP Server
   */
  async stopServer(name) {
    const client = this.clients.get(name);
    if (!client) return;

    try {
      await client.disconnect();
    } catch (err) {
      // ignore
    }

    this.clients.delete(name);

    // 移除工具映射
    for (const [toolName, info] of this.toolMap) {
      if (info.serverName === name) {
        this.toolMap.delete(toolName);
      }
    }

    this.toolRegistry.clearMCPTools();

    // 重新注册剩余的工具
    for (const [serverName, c] of this.clients) {
      try {
        const tools = await c.listTools();
        for (const tool of tools) {
          this.toolRegistry.registerMCPTool(tool, async (tn, args) => {
            return c.callTool(tn, args);
          });
          this.toolMap.set(tool.name, { client: c, serverName });
        }
      } catch (err) {
        // skip
      }
    }
  }

  /**
   * 创建默认 mcp.json 配置
   */
  createDefaultConfig() {
    const configDir = platform.getConfigDir();
    platform.ensureDir(configDir);

    const defaultConfig = {
      mcpServers: {
        // 示例：文件系统 MCP Server
        // 取消注释并安装后可用:
        // npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir
        //
        // filesystem: {
        //   command: 'npx',
        //   args: ['-y', '@modelcontextprotocol/server-filesystem', process.env.HOME],
        //   env: {},
        // },
      },
    };

    const configPath = platform.getMcpConfigPath();
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    }
  }

  /**
   * 获取已连接的 Server 列表
   */
  listServers() {
    const result = [];
    for (const [name, client] of this.clients) {
      const tools = [];
      for (const [toolName, info] of this.toolMap) {
        if (info.serverName === name) {
          tools.push(toolName);
        }
      }
      result.push({
        name,
        initialized: client.initialized,
        toolCount: tools.length,
        tools,
      });
    }
    return result;
  }
}

module.exports = MCPManager;
