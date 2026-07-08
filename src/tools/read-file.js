/**
 * 读取文件工具
 */
const fs = require('fs');
const path = require('path');

module.exports = async function readFile({ path: filePath, start_line, line_count }) {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    return `错误: 文件不存在: ${absPath}`;
  }

  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    return `错误: 路径是一个目录: ${absPath}。使用 list_directory 查看内容。`;
  }

  // 检查文件大小（超过 1MB 的二进制文件拒绝读取）
  if (stat.size > 10 * 1024 * 1024) {
    return `错误: 文件过大 (${(stat.size / 1024 / 1024).toFixed(1)} MB)，超过 10MB 限制`;
  }

  try {
    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');

    const start = Math.max(1, start_line || 1);
    const count = line_count || lines.length - start + 1;
    const end = Math.min(lines.length, start + count - 1);

    const selected = lines.slice(start - 1, end);

    // 构建带行号的输出
    const maxLineNum = String(end).length;
    let output = `文件: ${absPath}\n`;
    output += `行数: ${start}-${end} / 共 ${lines.length} 行\n`;
    output += `${'─'.repeat(60)}\n`;

    for (let i = 0; i < selected.length; i++) {
      const lineNum = String(start + i).padStart(maxLineNum, ' ');
      output += `${lineNum} │ ${selected[i]}\n`;
    }

    return output;
  } catch (err) {
    if (err.code === 'EACCES') {
      return `错误: 没有权限读取文件: ${absPath}`;
    }
    return `错误: 读取文件失败: ${err.message}`;
  }
};
