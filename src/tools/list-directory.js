/**
 * 列出目录内容工具
 */
const fs = require('fs');
const path = require('path');

module.exports = async function listDirectory({ path: dirPath, recursive = false, max_depth = 2, max_results = 100 }) {
  const absPath = dirPath ? path.resolve(dirPath) : process.cwd();

  if (!fs.existsSync(absPath)) {
    return `错误: 目录不存在: ${absPath}`;
  }

  const stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    return `错误: 路径不是目录: ${absPath}。使用 read_file 读取文件。`;
  }

  const results = [];

  function list(dir, depth, prefix) {
    if (results.length >= max_results) return;
    if (depth > max_depth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      results.push({ display: `${prefix}[无权限访问]` });
      return;
    }

    // 排序：目录在前，文件在后；字母序
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (results.length >= max_results) return;

      // 跳过隐藏文件
      if (entry.name.startsWith('.')) continue;
      if (['node_modules', '__pycache__', '.git'].includes(entry.name)) {
        results.push({ display: `${prefix}📁 ${entry.name}/ (已忽略)` });
        continue;
      }

      if (entry.isDirectory()) {
        results.push({ display: `${prefix}📁 ${entry.name}/` });
        if (recursive) {
          list(path.join(dir, entry.name), depth + 1, prefix + '  ');
        }
      } else if (entry.isFile()) {
        try {
          const s = fs.statSync(path.join(dir, entry.name));
          const sizeStr = s.size > 1024 * 1024
            ? `${(s.size / 1024 / 1024).toFixed(1)}M`
            : s.size > 1024
              ? `${(s.size / 1024).toFixed(1)}K`
              : `${s.size}B`;
          results.push({ display: `${prefix}📄 ${entry.name} (${sizeStr})` });
        } catch (err) {
          results.push({ display: `${prefix}📄 ${entry.name}` });
        }
      } else if (entry.isSymbolicLink()) {
        results.push({ display: `${prefix}🔗 ${entry.name}` });
      }
    }
  }

  list(absPath, 0, '');

  if (results.length === 0) {
    return `目录为空: ${absPath}`;
  }

  let output = `目录: ${absPath}\n\n`;
  for (const r of results) {
    output += r.display + '\n';
  }

  if (results.length >= max_results) {
    output += `\n... 结果已达到上限 ${max_results}`;
  }

  return output;
};
