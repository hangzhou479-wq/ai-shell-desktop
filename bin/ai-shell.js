#!/usr/bin/env node

/**
 * AI-Shell CLI 入口
 * 对接 DeepSeek API 的 AI 编程助手
 */

const { parseCLIArgs, showHelp } = require('../src/cli');

// 解析命令行参数
const { values } = parseCLIArgs(process.argv);

// 处理特殊标志
if (values.help) {
  showHelp();
  process.exit(0);
}

if (values.version) {
  const pkg = require('../package.json');
  console.log(`AI-Shell v${pkg.version}`);
  console.log(`Node.js ${process.version}`);
  console.log(`平台: ${process.platform} ${process.arch}`);
  process.exit(0);
}

// 将 CLI 参数映射到配置选项
const options = {};

if (values['api-key']) {
  options.apiKey = values['api-key'];
}
if (values.model) {
  options.model = values.model;
}
if (values.setup) {
  options.setup = true;
}
if (values.prompt) {
  options.prompt = values.prompt;
}
if (values['no-stream']) {
  options.stream = false;
}
if (values['no-confirm']) {
  options.requireConfirmation = false;
}
if (values.session) {
  options.session = values.session;
}
if (values.continue) {
  options.continue = true;
}
if (values['health-check']) {
  options.healthCheck = true;
}
if (values['list-sessions']) {
  options.listSessions = true;
}
if (values['list-models']) {
  options.listModels = true;
}

// 如果有位置参数（未关联到选项的自由参数），作为 prompt
if (values._ && values._.length > 0) {
  options.prompt = values._.join(' ');
}

// 启动应用
const { bootstrap } = require('../src/index');

bootstrap(options).catch((err) => {
  console.error(`\x1b[31m致命错误: ${err.message}\x1b[0m`);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
