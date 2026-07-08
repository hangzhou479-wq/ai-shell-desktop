/**
 * 命令行参数解析
 * 使用 Node.js 内置 util.parseArgs (Node 18.3+)
 */
const { parseArgs } = require('util');

function parseCLIArgs(argv) {
  const options = {
    // 配置
    'api-key':       { type: 'string',  short: 'k' },
    'model':         { type: 'string',  short: 'm' },
    'setup':         { type: 'boolean', short: 's' },

    // 运行模式
    'prompt':        { type: 'string',  short: 'p' },
    'file':          { type: 'string',  short: 'f' },
    'no-stream':     { type: 'boolean' },
    'no-confirm':    { type: 'boolean' },

    // 信息
    'version':       { type: 'boolean', short: 'v' },
    'help':          { type: 'boolean', short: 'h' },
    'health-check':  { type: 'boolean' },
    'list-models':   { type: 'boolean' },
    'list-sessions': { type: 'boolean' },

    // 会话
    'session':       { type: 'string' },
    'continue':      { type: 'boolean', short: 'c' },
  };

  try {
    return parseArgs({ options, allowPositionals: true });
  } catch (err) {
    // 未识别的选项，给出友好提示
    console.error(`错误: ${err.message}`);
    console.error('运行 ai-shell --help 查看可用选项');
    process.exit(1);
  }
}

function showHelp() {
  const pkg = require('../package.json');
  console.log(`
╔══════════════════════════════════════════════╗
║          AI-Shell v${pkg.version}                         ║
║          DeepSeek 驱动的 AI 编程助手            ║
╚══════════════════════════════════════════════╝

用法: ai-shell [选项] [提示内容]

选项:
  -k, --api-key <key>   设置 DeepSeek API Key
  -m, --model <name>    指定模型 (默认: deepseek-chat)
  -s, --setup           运行初始化设置向导
  -p, --prompt <text>   直接输入提示（非交互模式）
  -f, --file <path>     从文件读取提示内容
  --no-stream           禁用流式输出
  --no-confirm          跳过工具操作的确认步骤
  -c, --continue        继续上一次会话
  --session <name>      指定会话名称
  --list-sessions       列出所有已保存的会话
  --list-models         列出可用模型
  --health-check        检查 API 连接和配置
  -v, --version         显示版本号
  -h, --help            显示此帮助信息

示例:
  ai-shell                              # 启动交互式对话
  ai-shell -p "读取 package.json"        # 单次提问
  ai-shell -m deepseek-reasoner         # 使用推理模型
  ai-shell -k sk-xxxx                   # 设置 API Key
  ai-shell -c                           # 继续上次对话
  ai-shell --session my-project         # 使用指定会话

环境变量:
  DEEPSEEK_API_KEY     API 密钥（优先级最高）
  DEEPSEEK_API_BASE    API 地址（默认: https://api.deepseek.com）
  AI_SHELL_PROXY       HTTP 代理地址
  AI_SHELL_NO_CONFIRM  设为 1 禁用工具确认

DeepSeek API Key 获取: https://platform.deepseek.com
项目主页: https://github.com/ai-shell/ai-shell
`);
}

module.exports = { parseCLIArgs, showHelp };
