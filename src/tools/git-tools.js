/**
 * Git 工具集
 * 通过 shell 执行 git 命令，返回格式化结果
 */
const { execSync } = require('child_process');
const path = require('path');

function runGit(args, cwd) {
  try {
    const result = execSync(`git ${args}`, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, GIT_PAGER: 'cat', NO_COLOR: '1' },
    });
    return result.trim();
  } catch (err) {
    const msg = (err.stderr || '').split('\n')[0] || err.message;
    if (msg.includes('not a git repository')) {
      return '__NOT_A_GIT_REPO__';
    }
    return `Git 错误: ${msg}`;
  }
}

module.exports = {
  gitStatus: async function() {
    const result = runGit('status --short --branch');
    if (result === '__NOT_A_GIT_REPO__') {
      return '当前目录不是 Git 仓库';
    }
    if (!result) return '工作区干净，没有变更';
    return 'Git 状态:\n\n' + result;
  },

  gitDiff: async function({ staged = false } = {}) {
    const flag = staged ? '--staged' : '';
    const result = runGit(`diff ${flag} --stat`);
    if (result === '__NOT_A_GIT_REPO__') {
      return '当前目录不是 Git 仓库';
    }
    if (!result) return staged ? '暂存区没有变更' : '工作区没有变更';

    // 同时获取详细 diff（限制行数）
    const detail = runGit(`diff ${flag} --unified=3 -- . ':(exclude)node_modules' ':(exclude)package-lock.json' | head -200`);
    if (detail && detail.length > 10) {
      return '变更文件:\n' + result + '\n\n详细 Diff:\n' + detail;
    }
    return '变更文件:\n' + result;
  },

  gitLog: async function({ count = 10, file } = {}) {
    const fileArg = file ? `-- ${file}` : '';
    const result = runGit(`log --oneline -${Math.min(count, 50)} ${fileArg}`);
    if (result === '__NOT_A_GIT_REPO__') {
      return '当前目录不是 Git 仓库';
    }
    if (!result) return '暂无提交记录';
    return '最近提交:\n\n' + result;
  },

  gitCommit: async function({ message, files = '.' } = {}) {
    if (!message) return '错误: 需要提供提交信息 (message)';

    // 检查是否有变更
    const statusResult = runGit('status --porcelain');
    if (statusResult === '__NOT_A_GIT_REPO__') {
      return '当前目录不是 Git 仓库';
    }
    if (!statusResult) return '没有需要提交的变更';

    // 添加文件
    const addResult = runGit(`add ${files}`);
    if (addResult && addResult.startsWith('Git 错误')) return addResult;

    // 提交
    const escapedMsg = message.replace(/"/g, '\\"');
    const commitResult = runGit(`commit -m "${escapedMsg}"`);
    if (commitResult && commitResult.startsWith('Git 错误')) return commitResult;

    return '提交成功:\n' + commitResult;
  },
};
