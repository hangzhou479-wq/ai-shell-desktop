/**
 * 工具调用分发器
 * 处理安全确认、危险命令拦截、工具执行
 */
const readline = require('readline');
const colors = require('../terminal/colors');
const constants = require('../constants');

/**
 * 创建工具分发函数
 * @param {ToolRegistry} registry - 工具注册中心
 * @param {Object} config - 配置对象
 * @returns {Function} dispatch(toolName, args) => result
 */
function createDispatcher(registry, config = {}) {
  return async function dispatch(toolName, args) {
    const handler = registry.findHandler(toolName);

    if (!handler) {
      throw new Error(`未知工具: ${toolName}。可用工具: ${registry.listNames().map(t => t.name).join(', ')}`);
    }

    // 检查是否需要确认
    const requireConfirm = registry.requiresConfirm(toolName) && config.requireConfirmation !== false;

    if (requireConfirm) {
      const confirmed = await requestConfirmation(toolName, args);

      if (!confirmed) {
        return { cancelled: true, message: '用户取消了操作' };
      }

      if (confirmed === 'always') {
        // 本次会话中对该工具不再确认
        registry.tools.find(t => t.definition.function.name === toolName).requireConfirm = false;
      }
    }

    // 执行工具
    return await handler(args);
  };
}

/**
 * 请求用户确认
 * @returns {Promise<boolean|'always'>} true=确认, false=取消, 'always'=总是允许
 */
async function requestConfirmation(toolName, args) {
  console.log('');
  console.log(colors.bgYellow(colors.black(` ⚡ 需要确认 `)) + ` ${colors.yellow(toolName)}`);

  // 对危险命令的额外检查
  if (toolName === 'execute_command' && args.command) {
    const cmd = args.command;
    // 检查危险模式
    for (const pattern of constants.DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(cmd)) {
        console.log('');
        console.log(colors.bgRed(colors.white(' 🚫 危险命令已拦截 ')));
        console.log(colors.red(`该命令可能造成不可逆的损害: ${cmd.slice(0, 100)}`));
        console.log(colors.dim('如果确实需要执行，请手动在终端中运行'));
        return false;
      }
    }

    // 显示完整命令
    console.log('');
    console.log(colors.bold('命令:'));
    console.log(colors.cyan(`  ${cmd}`));
    if (args.working_dir) {
      console.log(colors.dim(`  工作目录: ${args.working_dir}`));
    }
    console.log('');
  }

  if (toolName === 'write_file' && args.path) {
    console.log('');
    console.log(colors.bold('写入文件:'));
    console.log(colors.cyan(`  ${args.path}`));

    // 如果文件已存在，显示警告
    const fs = require('fs');
    if (fs.existsSync(args.path)) {
      const stat = fs.statSync(args.path);
      const sizeStr = stat.size > 1024 ? `${(stat.size / 1024).toFixed(1)} KB` : `${stat.size} B`;
      console.log(colors.yellow(`  ⚠ 文件已存在 (${sizeStr})，将被覆写`));
    }

    // 显示内容预览
    if (args.content) {
      const preview = args.content.slice(0, 500);
      const lines = preview.split('\n');
      if (lines.length > 10) {
        console.log(colors.dim(`  内容预览 (${lines.length} 行):`));
        console.log(colors.dim(`  ${lines.slice(0, 5).join('\n  ')}`));
        console.log(colors.dim(`  ...`));
      } else {
        console.log(colors.dim(`  内容预览:`));
        console.log(colors.dim(`  ${lines.join('\n  ')}`));
      }
    }
    console.log('');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `${colors.bold('确认执行？')} [${colors.green('y')}=确认 / ${colors.yellow('a')}=总是允许 / ${colors.red('n')}=取消]: `,
      (answer) => {
        rl.close();
        const a = answer.trim().toLowerCase();
        if (a === 'y' || a === 'yes' || a === '') return resolve(true);
        if (a === 'a' || a === 'always') return resolve('always');
        return resolve(false);
      }
    );
  });
}

module.exports = { createDispatcher };
