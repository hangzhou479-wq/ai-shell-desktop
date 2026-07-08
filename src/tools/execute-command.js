/**
 * 执行 Shell 命令工具
 */
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function executeCommand({ command, working_dir }) {
  const cwd = working_dir ? path.resolve(working_dir) : process.cwd();

  // 再次检查危险命令（双重保险）
  const constants = require('../constants');
  for (const pattern of constants.DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return `错误: 命令被安全策略拦截。该命令可能造成不可逆的损害，请在终端中手动执行。`;
    }
  }

  try {
    const output = execSync(command, {
      cwd: cwd,
      encoding: 'utf-8',
      timeout: 30000, // 30 秒超时
      maxBuffer: 1024 * 1024, // 1MB 输出上限
      env: process.env,
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
    });

    const truncated = output.length > 5000
      ? output.slice(0, 5000) + `\n... (输出被截断，共 ${output.length} 字符)`
      : output;

    return `命令执行成功\n工作目录: ${cwd}\n命令: ${command}\n\n${truncated || '(无输出)'}`;
  } catch (err) {
    const stderr = err.stderr || '';
    const stdout = err.stdout || '';
    const truncated = (stderr + stdout).length > 5000
      ? (stderr + stdout).slice(0, 5000) + '\n... (输出被截断)'
      : (stderr + stdout);

    return `命令执行失败 (退出码: ${err.status || '未知'})\n工作目录: ${cwd}\n命令: ${command}\n\n${truncated || err.message}`;
  }
};
