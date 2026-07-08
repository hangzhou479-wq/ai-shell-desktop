/**
 * REPL 交互主循环
 * AI-Shell 的核心交互引擎，负责：
 * - readline 交互界面
 * - 多行输入处理
 * - 特殊命令分发
 * - Tool Calling 循环编排
 * - 流式输出渲染
 */
const readline = require('readline');
const colors = require('./terminal/colors');
const PromptFormatter = require('./terminal/prompt');
const Spinner = require('./terminal/spinner');
const { renderMarkdown } = require('./terminal/renderer');
const { ToolRegistry } = require('./tools/registry');
const { createDispatcher } = require('./tools/dispatcher');
const { runToolCallingLoop } = require('./api/chat');
const constants = require('./constants');
const HistoryManager = require('./utils/history');
const { findPluginCommand, getAllCommands, resetPlugins } = require('./config/plugins');

/**
 * 启动交互式 REPL
 */
async function startREPL(config, history, registry, mcpManager) {
  const prompt = new PromptFormatter(config.sessionName);
  const spinner = new Spinner();

  // 使用外部注入的 registry，如果没有则创建默认的
  if (!registry) {
    const { ToolRegistry } = require('./tools/registry');
    registry = new ToolRegistry();
  }

  const dispatch = createDispatcher(registry, config);

  // 打印欢迎信息
  console.log(PromptFormatter.getWelcome(config));

  // 创建 readline 接口
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: prompt.getPrompt(),
    terminal: true,
    historySize: 1000,
    removeHistoryDuplicates: true,
  });

  // 历史记录（用于上下箭头）
  const inputHistory = [];
  let historyIndex = -1;

  // 多行输入缓冲
  let multilineBuffer = [];
  let isMultiline = false;

  // 设置提示符
  rl.setPrompt(prompt.getPrompt());

  // 监听 SIGINT (Ctrl+C)
  let ctrlCPressed = 0;
  process.on('SIGINT', () => {
    ctrlCPressed++;
    if (ctrlCPressed >= 2) {
      // 双击 Ctrl+C 退出
      console.log(colors.dim('\n再见！'));
      rl.close();
      process.exit(0);
    }

    if (isMultiline) {
      // 取消多行输入
      console.log(colors.dim('\n已取消多行输入'));
      multilineBuffer = [];
      isMultiline = false;
      ctrlCPressed = 0;
      rl.setPrompt(prompt.getPrompt());
      rl.prompt();
      return;
    }

    console.log(colors.dim('\n(再按一次 Ctrl+C 退出)'));
    ctrlCPressed = 0;
    rl.prompt();
  });

  // 处理输入
  rl.on('line', async (input) => {
    ctrlCPressed = 0;

    // 多行输入模式
    if (isMultiline) {
      if (input.trim() === '') {
        // 空行结束多行输入
        const fullInput = multilineBuffer.join('\n');
        multilineBuffer = [];
        isMultiline = false;
        rl.setPrompt(prompt.getPrompt());
        await processInput(fullInput);
      } else {
        multilineBuffer.push(input);
      }
      rl.prompt();
      return;
    }

    // 以 \ 结尾表示多行输入
    if (input.endsWith('\\') && !input.endsWith('\\\\')) {
      isMultiline = true;
      multilineBuffer = [input.slice(0, -1)];
      rl.setPrompt(prompt.getContinuationPrompt());
      rl.prompt();
      return;
    }

    const trimmed = input.trim();

    // 空输入
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // 添加到历史
    if (trimmed) {
      inputHistory.push(trimmed);
      historyIndex = inputHistory.length;
    }

    await processInput(trimmed);
  });

  /**
   * 处理用户输入
   */
  async function processInput(input) {
    // 特殊命令
    if (input.startsWith('/')) {
      await handleCommand(input);
      rl.setPrompt(prompt.getPrompt());
      rl.prompt();
      return;
    }

    // 正常对话
    await handleConversation(input);
    rl.setPrompt(prompt.getPrompt());
    rl.prompt();
  }

  /**
   * 处理特殊命令
   */
  async function handleCommand(input) {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch (cmd) {
      case '/exit':
      case '/quit':
      case '/q':
        console.log(colors.dim('\n再见！'));
        if (config.autoSaveSession !== false) {
          history.save();
          console.log(colors.dim(`会话已保存: ${config.sessionName}`));
        }
        rl.close();
        process.exit(0);

      case '/help':
      case '/h':
        console.log(PromptFormatter.getHelp());
        break;

      case '/clear':
        history.clear();
        history.setSystemPrompt(constants.SYSTEM_PROMPT);
        prompt.messageCount = 0;
        console.log(colors.success('对话历史已清空'));
        break;

      case '/save':
        history.save();
        console.log(colors.success(`会话已保存: ${config.sessionName}`));
        break;

      case '/session': {
        if (arg) {
          // 切换会话
          history.save(); // 先保存当前
          config.sessionName = arg;
          const newHistory = new HistoryManager(arg);
          newHistory.load();
          Object.assign(history, newHistory);
          history.setSystemPrompt(constants.SYSTEM_PROMPT);
          console.log(colors.success(`已切换到会话: ${arg}`));
        } else {
          const sessions = HistoryManager.listSessions();
          console.log(colors.bold('\n已保存的会话:\n'));
          for (const s of sessions) {
            const marker = s.name === config.sessionName ? colors.green(' (当前)') : '';
            console.log(`  ${colors.cyan(s.name)}${marker} ${colors.dim(`- ${s.messages} 条消息`)}`);
          }
          if (sessions.length === 0) {
            console.log(colors.dim('  无已保存会话'));
          }
        }
        break;
      }

      case '/model': {
        if (arg) {
          config.model = arg;
          console.log(colors.success(`已切换模型: ${arg}`));
        } else {
          console.log(`当前模型: ${colors.cyan(config.model)}`);
          console.log(`可用模型: ${colors.dim('deepseek-chat, deepseek-reasoner')}`);
        }
        break;
      }

      case '/tokens': {
        const { estimateMessagesTokens } = require('./utils/token');
        const tokens = estimateMessagesTokens(history.getMessages());
        const maxContext = constants.MAX_CONTEXT_TOKENS;
        const pct = ((tokens / maxContext) * 100).toFixed(1);
        console.log(`Token 使用: ${colors.cyan(tokens)} / ${colors.dim(maxContext)} (${pct}%)`);
        console.log(`消息数: ${history.getMessages().length}`);
        break;
      }

      case '/config':
        console.log(colors.bold('\n当前配置:\n'));
        for (const [k, v] of Object.entries(config)) {
          if (k === 'apiKey') {
            console.log(`  ${k}: ${v ? colors.dim(v.slice(0, 7) + '...') : colors.red('未配置')}`);
          } else {
            console.log(`  ${k}: ${colors.cyan(JSON.stringify(v))}`);
          }
        }
        break;

      case '/tools': {
        const tools = registry.listNames();
        console.log(colors.bold(`\n可用工具 (${tools.length}):\n`));
        for (const t of tools) {
          const confirm = t.requireConfirm ? colors.yellow(' [需确认]') : '';
          const source = t.source === 'mcp' ? colors.dim(' [MCP]') : '';
          console.log(`  ${colors.cyan(t.name)}${confirm}${source}`);
          console.log(`    ${colors.dim(t.description)}`);
        }
        break;
      }

      case '/plugins':
        console.log(colors.bold('\n自定义命令:\n'));
        for (const cmd of getAllCommands()) {
          console.log(`  ${colors.cyan(cmd.name)}  ${colors.dim(cmd.description || '')}`);
        }
        console.log(colors.dim('\n编辑 ~/.ai-shell/plugins.json 自定义更多命令'));
        console.log(colors.dim('运行 /plugins-reset 恢复默认'));
        break;

      case '/plugins-reset':
        resetPlugins();
        console.log(colors.success('插件配置已恢复默认'));
        break;

      default: {
        // 检查是否为插件命令
        const plugin = findPluginCommand(cmd);
        if (plugin) {
          // 执行插件命令：将 prompt 模板 + 用户参数 拼接后发送
          const userInput = arg || '';
          const fullPrompt = userInput
            ? `${plugin.prompt}\n\n---\n用户输入:\n${userInput}`
            : plugin.prompt;

          await handleConversation(fullPrompt);
          return; // handleConversation 内部不需要再 prompt
        }

        console.log(colors.warn(`未知命令: ${cmd}`));
        console.log(colors.dim('输入 /help 查看可用命令'));
      }
    }
  }

  /**
   * 处理正常对话
   */
  async function handleConversation(input) {
    prompt.incrementMessage();
    history.addUserMessage(input);

    // 裁剪上下文
    const maxContext = constants.MAX_CONTEXT_TOKENS - constants.RESERVE_OUTPUT_TOKENS;
    history.trim(maxContext);

    // 构建工具列表
    const tools = registry.getToolDefinitions();

    // 用于收集流式内容
    let streamedContent = '';
    let firstToken = true;

    spinner.start('思考中...');

    try {
      const result = await runToolCallingLoop(config, history, {
        tools,
        dispatch,
        maxIterations: 10,

        onToken: (token) => {
          if (firstToken) {
            spinner.stop();
            process.stdout.write('\n');
            firstToken = false;
          }
          streamedContent += token;
          process.stdout.write(token);
        },

        onToolStart: (toolName, args) => {
          if (!firstToken) {
            process.stdout.write('\n');
            firstToken = true; // 重置以便下次输出
          }
          spinner.stop();

          const argStr = JSON.stringify(args).length > 80
            ? JSON.stringify(args).slice(0, 80) + '...'
            : JSON.stringify(args);

          console.log(colors.dim(`\n🔧 ${toolName} ${argStr}`));
        },

        onToolEnd: (toolName, err) => {
          if (err) {
            console.log(colors.error(`工具执行失败: ${err.message}`));
          }
          spinner.start('处理结果中...');
        },
      });

      spinner.stop();

      // 如果流式输出结束，确保换行
      if (streamedContent && !streamedContent.endsWith('\n')) {
        process.stdout.write('\n');
      }

      // 显示 Token 用量
      const { estimateMessagesTokens } = require('./utils/token');
      const tokens = estimateMessagesTokens(history.getMessages());
      const pct = ((tokens / constants.MAX_CONTEXT_TOKENS) * 100).toFixed(1);
      console.log(colors.dim(`\n[Token: ~${tokens} | 上下文: ${pct}%]`));

      if (result.truncated) {
        console.log(colors.warn('\n[响应因网络中断被截断，但已接收的内容已保留]'));
      }

    } catch (err) {
      spinner.stop();

      // 如果已经有一些流式输出，保留它
      if (streamedContent) {
        process.stdout.write('\n');
        console.log(colors.warn(`\n[响应中断: ${err.message}]`));
        console.log(colors.dim('已接收的内容已保留，可以继续对话'));
      } else {
        console.log(colors.error(`\n请求失败: ${err.message}`));
        console.log('');
        console.log(colors.dim('常见原因:'));
        console.log(colors.dim('  1. 网络连接问题 — 尝试设置代理'));
        console.log(colors.dim('  2. API Key 无效 — 运行 ai-shell --setup 重新配置'));
        console.log(colors.dim('  3. 账户余额不足 — 访问 platform.deepseek.com 充值'));
        console.log(colors.dim('  4. API 服务异常 — 稍后重试'));
      }
    }
  }

  // 处理回车
  rl.prompt();

  // 监听关闭
  rl.on('close', () => {
    if (config.autoSaveSession !== false) {
      history.save();
    }
  });

  // 返回 rl 以便外部可以 close
  return rl;
}

module.exports = { startREPL };
