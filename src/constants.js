/**
 * AI-Shell 常量定义
 * 集中管理所有 API 端点、模型名称、默认值等常量
 */
module.exports = {
  // DeepSeek API 配置
  API_BASE_URL: 'https://api.deepseek.com',
  API_CHAT_PATH: '/v1/chat/completions',
  DEFAULT_MODEL: 'deepseek-chat',
  REASONER_MODEL: 'deepseek-reasoner',

  // 请求配置
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY: 1000,    // 基础退避延迟 (ms)
  REQUEST_TIMEOUT: 120000,    // 请求超时 (ms)
  MAX_TOKENS_DEFAULT: 8192,

  // 上下文窗口
  MAX_CONTEXT_TOKENS: 64000,  // deepseek-chat 上下文上限
  RESERVE_OUTPUT_TOKENS: 4096, // 留给模型输出的 token

  // 应用路径
  CONFIG_DIR: '.ai-shell',
  CONFIG_FILE: 'config.json',
  MCP_CONFIG_FILE: 'mcp.json',
  HISTORY_DIR: 'sessions',

  // System Prompt
  SYSTEM_PROMPT: `你是 AI-Shell，一个直接、高效的 AI 编程助手。你有能力直接操作用户的文件系统和执行命令。

## 核心原则
- **直接动手，不要问**。用户让你做什么，你就调用工具去做，不要反复确认或给出替代方案。
- **简洁回复**。用最少的字说清楚，不要废话、不要道歉、不要"让我试一下"之类的铺垫。
- **用中文回复**。不管用户用什么语言，你都用中文。
- **能并行就并行**。多个独立的工具可以同时调用。

## 行为规范
- 读文件用 read_file，写文件用 write_file，改文件用 replace_in_file
- 执行命令用 execute_command，搜文件名用 search_file，搜内容用 search_content
- 执行命令前只做一句话说明，不要长篇大论
- 工具调用失败时，分析错误原因后直接重试，不要放弃
- 不要问"要我帮你做吗"，直接做
- 用户说"创建文件夹"就直接 mkdir，不要让他自己去终端操作`,

  // 危险命令黑名单
  DANGEROUS_COMMAND_PATTERNS: [
    /\brm\s+-rf\s+\/\b/,
    /\bsudo\s+rm\b/,
    /\bdd\s+if=/,
    /\b:(){ :|:& };:\b/,
    /\bchmod\s+777\s+\/\b/,
    /\bgit\s+push\s+--force\b.*\bmain\b/,
    /\bgit\s+push\s+--force\b.*\bmaster\b/,
    /\bdocker\s+rm\s+-f\b/,
    /\bformat\s+[A-Z]:\b/i,
  ],
};
