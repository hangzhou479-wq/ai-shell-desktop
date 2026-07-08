/**
 * 文件内容搜索工具（grep）
 */
const fs = require('fs');
const path = require('path');

module.exports = async function searchContent({
  pattern,
  directory,
  file_pattern,
  case_sensitive = false,
  max_results = 20,
}) {
  const baseDir = directory ? path.resolve(directory) : process.cwd();

  if (!fs.existsSync(baseDir)) {
    return `错误: 目录不存在: ${baseDir}`;
  }

  let searchRegex;
  try {
    searchRegex = new RegExp(pattern, case_sensitive ? 'g' : 'gi');
  } catch (err) {
    return `错误: 无效的正则表达式 "${pattern}": ${err.message}`;
  }

  // 文件类型过滤
  const fileRegex = file_pattern ? globToRegex(file_pattern) : null;

  // 要忽略的目录
  const ignoreDirs = new Set([
    'node_modules', '.git', '__pycache__', '.next', 'dist', 'build',
    'target', '.cache', '.idea', '.vscode', 'coverage',
  ]);

  // 要忽略的文件扩展名
  const ignoreExts = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.bmp',
    '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.webm',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib', '.wasm',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.woff', '.woff2', '.ttf', '.eot',
    '.lock', '.min.js', '.map',
  ]);

  // 二进制文件检测（前 512 字节中 null 字节比例）
  function isBinary(filePath) {
    try {
      const buf = fs.readFileSync(filePath);
      const sampleSize = Math.min(512, buf.length);
      let nullCount = 0;
      for (let i = 0; i < sampleSize; i++) {
        if (buf[i] === 0) nullCount++;
      }
      return nullCount > 0;
    } catch (err) {
      return true; // 读不了就算二进制
    }
  }

  const results = [];
  const maxDepth = 8;

  function walk(dir, depth) {
    if (depth > maxDepth || results.length >= max_results) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      if (results.length >= max_results) return;
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          walk(fullPath, depth + 1);
        }
        continue;
      }

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ignoreExts.has(ext)) continue;
        if (fileRegex && !fileRegex.test(entry.name)) continue;
        if (isBinary(fullPath)) continue;

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= max_results) break;

            if (searchRegex.test(lines[i])) {
              // 重置 lastIndex（全局正则需要）
              searchRegex.lastIndex = 0;

              const relativePath = path.relative(baseDir, fullPath);
              const trimmedLine = lines[i].length > 200
                ? lines[i].slice(0, 200) + '...'
                : lines[i];

              results.push({
                file: relativePath,
                line: i + 1,
                content: trimmedLine.trim(),
              });
            }
          }
        } catch (err) {
          // 跳过无法读取的文件
        }
      }
    }
  }

  walk(baseDir, 0);

  if (results.length === 0) {
    return `未找到包含 "${pattern}" 的文件 (搜索目录: ${baseDir})`;
  }

  let output = `找到 ${results.length} 个包含 "${pattern}" 的结果:\n\n`;
  for (const r of results) {
    output += `  ${r.file}:${r.line}\n`;
    output += `    ${r.content}\n`;
  }

  if (results.length >= max_results) {
    output += `\n... 结果已达到上限 ${max_results}，请缩小搜索范围`;
  }

  return output;
};

function globToRegex(pattern) {
  let regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`, 'i');
}
