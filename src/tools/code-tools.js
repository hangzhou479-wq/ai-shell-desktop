/**
 * 代码工具集：审查、调试、项目管理
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
  // 代码审查 — 基于 git diff 自动分析
  codeReview: async function({ directory }) {
    const cwd = directory ? path.resolve(directory) : process.cwd();

    try {
      // 获取变更文件列表
      let diff = '';
      try {
        diff = execSync('git diff --unified=5 -- . ":(exclude)node_modules" ":(exclude)package-lock.json" ":(exclude)*.lock"', {
          cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024,
        });
      } catch (e) { diff = e.stdout || ''; }

      // 暂存区变更
      let staged = '';
      try {
        staged = execSync('git diff --staged --unified=5 -- . ":(exclude)node_modules"', {
          cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024,
        });
      } catch (e) { staged = e.stdout || ''; }

      const totalDiff = (diff + '\n' + staged).trim();
      if (!totalDiff || totalDiff.length < 10) {
        return '工作区干净，没有未提交的变更。如果已提交，可以用 git_diff 查看已提交的变更。';
      }

      // 截取前 8000 字符
      const truncated = totalDiff.length > 8000 ? totalDiff.slice(0, 8000) + '\n...（diff 已截断）' : totalDiff;

      return `代码变更分析（请基于以下 diff 进行审查）:\n\n${truncated}`;
    } catch (err) {
      return `获取 diff 失败: ${err.message}\n当前目录可能不是 Git 仓库。`;
    }
  },

  // 代码分析 — 运行代码并捕获输出/错误
  codeRun: async function({ file, command, language }) {
    if (!command && !file) return '错误: 需要提供 file 或 command';

    try {
      let cmd;
      if (command) {
        cmd = command;
      } else {
        const ext = path.extname(file || '').toLowerCase();
        const langMap = {
          '.js': `node "${file}"`, '.ts': `npx tsx "${file}"`,
          '.py': `python3 "${file}"`, '.rb': `ruby "${file}"`,
          '.go': `go run "${file}"`, '.rs': `rustc "${file}" -o /tmp/a.out && /tmp/a.out`,
          '.sh': `bash "${file}"`, '.java': `javac "${file}" && java "${file.replace('.java','')}"`,
        };
        cmd = langMap[ext] || (language ? `${language} "${file}"` : `node "${file}"`);
      }

      const result = execSync(cmd, {
        encoding: 'utf-8', timeout: 30000, maxBuffer: 1024 * 1024,
        env: { ...process.env, CI: 'true', PYTHONUNBUFFERED: '1' },
        shell: '/bin/bash',
      });

      const output = result.length > 3000 ? result.slice(0, 3000) + '\n...（输出已截断）' : result;
      return `✅ 运行成功:\n${output || '(无输出)'}`;
    } catch (err) {
      const stderr = (err.stderr || '').slice(0, 3000);
      const stdout = (err.stdout || '').slice(0, 2000);
      return `❌ 运行失败 (退出码: ${err.status}):\n\n标准输出:\n${stdout || '(无)'}\n\n错误输出:\n${stderr || err.message}`;
    }
  },

  // 代码静态分析（基础 lint）
  codeLint: async function({ file, directory }) {
    const cwd = directory ? path.resolve(directory) : process.cwd();
    const target = file ? path.resolve(file) : cwd;
    const results = [];

    // ESLint
    try {
      execSync(`npx eslint "${target}" --format compact 2>&1 | head -30`, {
        cwd, encoding: 'utf-8', timeout: 30000, stdio: 'pipe',
      });
    } catch (e) {
      const out = (e.stdout || '').trim();
      if (out && !out.includes('ESLint couldn')) results.push('ESLint:\n' + out);
    }

    if (results.length === 0) {
      return '未发现明显问题，或项目中未配置 ESLint。\n建议在项目中添加 ESLint 配置以获得更好的静态分析。';
    }

    return '静态分析结果:\n\n' + results.join('\n\n');
  },
};
