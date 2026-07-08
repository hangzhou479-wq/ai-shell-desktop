/**
 * AI-Shell 主入口
 * 负责启动流程：加载配置 → 检查 API Key → 初始化会话 → 启动 REPL
 */
const { load } = require('./config/loader');
const { getApiKey, promptApiKey } = require('./config/api-key');
const HistoryManager = require('./utils/history');
const PromptFormatter = require('./terminal/prompt');
const colors = require('./terminal/colors');
const platform = require('./utils/platform');

async function bootstrap(cliOptions = {}) {
  // 1. 加载配置
  const config = load();
  Object.assign(config, cliOptions);

  // 2. API Key
  const { key, source } = getApiKey(config);
  if (key) {
    config.apiKey = key;
    if (!cliOptions.prompt) {
      console.log(colors.dim(`API Key: 已从${source}加载`));
    }
  } else if (config.setup || !cliOptions.prompt) {
    // 交互模式或 setup 模式，引导输入
    const promptedKey = await promptApiKey();
    if (promptedKey) {
      config.apiKey = promptedKey;
    } else {
      console.log(colors.warn('未配置 API Key。使用 ai-shell --setup 配置或设置环境变量 DEEPSEEK_API_KEY'));
      console.log(colors.info('获取 API Key: https://platform.deepseek.com'));
      process.exit(1);
    }
  }

  // 3. 确保配置目录存在
  platform.ensureDir(platform.getConfigDir());
  platform.ensureDir(platform.getSessionsDir());

  // 4. 初始化会话
  const sessionName = config.session || 'default';
  const history = new HistoryManager(sessionName);
  config.sessionName = sessionName;

  if (config.continue) {
    const loaded = history.load();
    if (loaded) {
      console.log(colors.dim(`已恢复会话 "${sessionName}"`));
    } else {
      console.log(colors.warn(`未找到会话 "${sessionName}"，将创建新会话`));
    }
  }

  // 5. 初始化 system prompt
  history.setSystemPrompt(require('./constants').SYSTEM_PROMPT);

  // 6. 处理特殊命令
  if (config.listSessions) {
    const sessions = HistoryManager.listSessions();
    if (sessions.length === 0) {
      console.log(colors.dim('没有已保存的会话'));
    } else {
      console.log(colors.bold('\n已保存的会话:\n'));
      for (const s of sessions) {
        const d = s.createdAt ? new Date(s.createdAt).toLocaleString('zh-CN') : '未知';
        console.log(`  ${colors.cyan(s.name)}  ${colors.dim(`(${s.messages} 条消息, ${d})`)}`);
      }
    }
    return;
  }

  if (config.healthCheck) {
    await runHealthCheck(config);
    return;
  }

  // 7. 单次提示模式（非交互）
  if (config.prompt) {
    return await runSinglePrompt(config, history, config.prompt);
  }

  // 8. 初始化工具注册中心 + MCP
  const { ToolRegistry } = require('./tools/registry');
  const MCPManager = require('./mcp/manager');
  const registry = new ToolRegistry();
  const mcpManager = new MCPManager(registry);

  if (config.mcpEnabled !== false) {
    await mcpManager.startAll();
  }

  // 9. 启动交互式 REPL
  const { startREPL } = require('./repl');
  await startREPL(config, history, registry, mcpManager);

  // 9. 退出前保存
  if (config.autoSaveSession !== false) {
    history.save();
    console.log(colors.dim(`\n会话已保存: ${sessionName}`));
  }
}

/**
 * 运行单次提示（非交互模式）
 */
async function runSinglePrompt(config, history, userPrompt) {
  const { sendMessage } = require('./api/chat');
  history.addUserMessage(userPrompt);

  try {
    const response = await sendMessage(config, history.getMessages(), {
      stream: config.stream !== false,
      onToken: (token) => process.stdout.write(token),
    });

    if (response.content) {
      history.addAssistantMessage(response.content, response.tool_calls);
    }

    if (config.autoSaveSession !== false) {
      history.save();
    }
  } catch (err) {
    console.error(colors.error(`请求失败: ${err.message}`));
    process.exit(1);
  }
}

/**
 * 健康检查
 */
async function runHealthCheck(config) {
  console.log(colors.bold('\nAI-Shell 健康检查\n'));
  const checks = [];

  // Node.js 版本
  const nodeVersion = process.version;
  const nodeOK = parseInt(process.version.slice(1)) >= 18;
  checks.push({
    name: 'Node.js 版本',
    status: nodeOK ? 'ok' : 'fail',
    detail: `${nodeVersion} ${nodeOK ? '✓' : '✗ (需要 >= 18.0.0)'}`,
  });

  // 配置目录
  const configDir = platform.getConfigDir();
  const fs = require('fs');
  checks.push({
    name: '配置目录',
    status: fs.existsSync(configDir) ? 'ok' : 'warn',
    detail: configDir,
  });

  // API Key
  const { key } = getApiKey(config);
  checks.push({
    name: 'API Key',
    status: key ? 'ok' : 'fail',
    detail: key ? `已配置 (${key.slice(0, 7)}...)` : '未配置',
  });

  // API 连接测试
  if (key) {
    try {
      const { checkConnection } = require('./api/client');
      const result = await checkConnection(config);
      checks.push({
        name: 'API 连接',
        status: result.ok ? 'ok' : 'fail',
        detail: result.ok ? '连接正常' : result.error,
      });
    } catch (err) {
      checks.push({
        name: 'API 连接',
        status: 'fail',
        detail: err.message,
      });
    }
  }

  // 显示结果
  for (const c of checks) {
    const icon = c.status === 'ok' ? colors.green('✓') : c.status === 'warn' ? colors.yellow('⚠') : colors.red('✗');
    console.log(`  ${icon} ${c.name}: ${colors.dim(c.detail)}`);
  }

  console.log('');
}

module.exports = { bootstrap };
