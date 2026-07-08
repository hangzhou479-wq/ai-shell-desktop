/**
 * 定制 REPL 提示符
 * 显示当前会话状态
 */
const os = require('os');
const path = require('path');
const colors = require('./colors');

class PromptFormatter {
  constructor(sessionName = 'default') {
    this.sessionName = sessionName;
    this.messageCount = 0;
  }

  /**
   * 获取当前提示符
   */
  getPrompt() {
    const cwd = process.cwd();
    const home = os.homedir();
    const displayPath = cwd.startsWith(home)
      ? '~' + cwd.slice(home.length)
      : cwd;

    const dir = path.basename(displayPath) || displayPath;
    const msgInfo = this.messageCount > 0
      ? colors.dim(` [${this.messageCount}]`)
      : '';

    return `${colors.cyan('❯')} ${colors.bold(dir)}${msgInfo}\n`;
  }

  /**
   * 获取多行输入的续行提示
   */
  getContinuationPrompt() {
    return colors.dim('▏ ');
  }

  /**
   * 增加消息计数
   */
  incrementMessage() {
    this.messageCount++;
  }

  /**
   * 欢迎信息
   */
  static getWelcome(config) {
    return `
${colors.header('╔══════════════════════════════════════════════════╗')}
${colors.header('║          AI-Shell — DeepSeek AI 编程助手            ║')}
${colors.header('╚══════════════════════════════════════════════════╝')}

${colors.dim('模型:')}   ${colors.cyan(config.model)}
${colors.dim('会话:')}   ${config.sessionName || 'default'}
${colors.dim('工作目录:')} ${process.cwd()}

${colors.dim('输入 /help 查看帮助，/exit 退出')}
`;
  }

  /**
   * 帮助信息
   */
  static getHelp() {
    return `
${colors.bold('系统命令:')}

  ${colors.cyan('/help')}         显示此帮助信息
  ${colors.cyan('/exit')}         退出（/quit 或 Ctrl+C）
  ${colors.cyan('/clear')}        清空对话历史
  ${colors.cyan('/save')}         保存当前会话
  ${colors.cyan('/session')}      显示/切换会话
  ${colors.cyan('/model')}        切换模型 (deepseek-chat / deepseek-reasoner)
  ${colors.cyan('/tokens')}       显示 token 使用估算
  ${colors.cyan('/config')}       显示当前配置
  ${colors.cyan('/tools')}        列出可用工具
  ${colors.cyan('/plugins')}      列出插件命令
  ${colors.cyan('/plugins-reset')} 重置插件配置

${colors.bold('内置快捷命令 (自动发送优化过的 prompt):')}

  ${colors.cyan('/review')}      Code Review — 代码质量和安全审查
  ${colors.cyan('/fix')}         修复 Bug — 分析并修复代码问题
  ${colors.cyan('/test')}        生成测试 — 编写单元测试
  ${colors.cyan('/explain')}     解释代码 — 逐行解释逻辑
  ${colors.cyan('/optimize')}    优化性能 — 分析和优化
  ${colors.cyan('/refactor')}    重构代码 — 改善结构

  ${colors.dim('用法: /review 选中代码后粘贴，或直接 /review 让AI读取文件')}
  ${colors.dim('自定义: 编辑 ~/.ai-shell/plugins.json 添加自己的命令')}

${colors.bold('快捷键:')}

  ${colors.cyan('Enter')}        发送消息
  ${colors.cyan('Shift+Enter')}  换行（多行输入）
  ${colors.cyan('Ctrl+C')}       退出（按两次）
  ${colors.cyan('Ctrl+L')}       清屏

${colors.bold('提示:')}
  直接输入问题即可开始对话，AI-Shell 会自动调用工具来完成任务。
  例如: "读取 package.json 文件内容"
`;
  }
}

module.exports = PromptFormatter;
