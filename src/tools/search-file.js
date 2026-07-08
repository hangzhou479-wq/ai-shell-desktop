/**
 * 文件搜索工具（glob 匹配）
 */
const fs = require('fs');
const path = require('path');

module.exports = async function searchFile({ pattern, directory, max_results = 50 }) {
  const baseDir = directory ? path.resolve(directory) : process.cwd();

  if (!fs.existsSync(baseDir)) {
    return `错误: 目录不存在: ${baseDir}`;
  }

  // 将 glob 模式转换为正则
  const regex = globToRegex(pattern);

  const results = [];
  const maxDepth = 10;
  const maxFiles = max_results;

  function walk(dir, depth) {
    if (depth > maxDepth || results.length >= maxFiles) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return; // 跳过无权限的目录
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // 跳过隐藏文件和常见忽略目录
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      if (entry.isDirectory() && ['node_modules', '__pycache__', '.git', 'dist', 'build', 'target'].includes(entry.name)) {
        continue;
      }

      if (entry.isFile() && regex.test(entry.name)) {
        try {
          const stat = fs.statSync(fullPath);
          results.push({
            path: relativePath,
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        } catch (err) {
          // 跳过
        }
      }

      if (entry.isDirectory()) {
        // 如果 pattern 包含路径分隔符，检查目录匹配
        if (regex.test(entry.name) || regex.test(relativePath)) {
          if (results.length < maxFiles) {
            walk(fullPath, depth + 1);
          }
        } else {
          walk(fullPath, depth + 1);
        }
      }
    }
  }

  walk(baseDir, 0);

  if (results.length === 0) {
    return `未找到匹配 "${pattern}" 的文件 (搜索目录: ${baseDir})`;
  }

  let output = `找到 ${results.length} 个匹配 "${pattern}" 的文件:\n\n`;
  for (const r of results) {
    const sizeStr = r.size > 1024 ? `${(r.size / 1024).toFixed(1)}K` : `${r.size}B`;
    const date = new Date(r.modified).toLocaleDateString('zh-CN');
    output += `  ${r.path}  (${sizeStr}, ${date})\n`;
  }

  if (results.length >= max_results) {
    output += `\n... 结果已达到上限 ${max_results}，请缩小搜索范围`;
  }

  return output;
};

/**
 * 简易 glob 转正则
 */
function globToRegex(pattern) {
  let regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(',').join('|')})`);

  return new RegExp(`^${regexStr}$`, 'i');
}
