/**
 * 精准替换文件内容工具（内联 diff 编辑）
 * 类似 VS Code 的精确替换：找到 old_string → 替换为 new_string
 */
const fs = require('fs');
const path = require('path');

module.exports = async function replaceInFile({ path: filePath, old_string, new_string }) {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    return `错误: 文件不存在: ${absPath}`;
  }

  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    return `错误: 路径是目录，不是文件: ${absPath}`;
  }

  if (stat.size > 5 * 1024 * 1024) {
    return `错误: 文件过大 (${(stat.size / 1024 / 1024).toFixed(1)} MB)，超过 5MB 限制`;
  }

  try {
    const content = fs.readFileSync(absPath, 'utf-8');

    // 查找 old_string
    const index = content.indexOf(old_string);
    if (index === -1) {
      return `错误: 在文件中未找到指定的旧内容。请检查：
1. 内容是否完全匹配（包括缩进、空格和换行）
2. 是否存在多余或缺失的空白字符
3. 建议先用 read_file 查看文件当前内容`;
    }

    // 检查是否有多个匹配
    const secondIndex = content.indexOf(old_string, index + 1);
    if (secondIndex !== -1) {
      return `错误: 旧内容在文件中出现了多次。请提供更多上下文使匹配唯一。
第 1 次出现: 第 ${getLineNumber(content, index)} 行
第 2 次出现: 第 ${getLineNumber(content, secondIndex)} 行`;
    }

    // 备份
    if (fs.existsSync(absPath)) {
      fs.copyFileSync(absPath, absPath + '.bak');
    }

    // 执行替换
    const newContent = content.slice(0, index) + new_string + content.slice(index + old_string.length);
    fs.writeFileSync(absPath, newContent, 'utf-8');

    // 生成 diff 摘要
    const oldLine = getLineNumber(content, index);
    const oldLines = old_string.split('\n');
    const newLines = new_string.split('\n');
    const lineDelta = newLines.length - oldLines.length;

    let result = `已成功替换 ${absPath} 中的内容\n`;
    result += `位置: 第 ${oldLine} 行\n`;
    result += `变更: ${oldLines.length} 行 → ${newLines.length} 行`;
    if (lineDelta !== 0) result += ` (${lineDelta > 0 ? '+' : ''}${lineDelta})`;
    result += '\n';

    // 显示 diff 预览
    result += '\n─── 旧内容 ──→ 新内容 ───\n';
    const maxPreview = 5;
    for (let i = 0; i < Math.min(oldLines.length, newLines.length, maxPreview); i++) {
      if (oldLines[i] !== newLines[i]) {
        result += `- ${oldLines[i]}\n`;
        result += `+ ${newLines[i]}\n`;
      }
    }
    if (oldLines.length > maxPreview || newLines.length > maxPreview) {
      result += '... (更多行已替换)\n';
    }

    return result;
  } catch (err) {
    if (err.code === 'EACCES') {
      return `错误: 没有权限修改文件: ${absPath}`;
    }
    return `错误: 替换失败: ${err.message}`;
  }
};

function getLineNumber(content, index) {
  const before = content.slice(0, index);
  return before.split('\n').length;
}
