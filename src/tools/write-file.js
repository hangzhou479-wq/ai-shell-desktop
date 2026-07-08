/**
 * 写入文件工具
 */
const fs = require('fs');
const path = require('path');

module.exports = async function writeFile({ path: filePath, content }) {
  const absPath = path.resolve(filePath);

  // 安全检查：不允许写入到某些敏感目录
  const dangerousPaths = ['/etc', '/System', '/boot', 'C:\\Windows', 'C:\\Windows\\System32'];
  for (const dp of dangerousPaths) {
    if (absPath.toLowerCase().startsWith(dp.toLowerCase())) {
      return `错误: 不允许写入系统目录: ${dp}`;
    }
  }

  try {
    // 确保父目录存在
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 备份旧文件（如果存在）
    if (fs.existsSync(absPath)) {
      const backup = absPath + '.bak';
      fs.copyFileSync(absPath, backup);
    }

    // 写入文件
    fs.writeFileSync(absPath, content, 'utf-8');

    const stat = fs.statSync(absPath);
    const lines = content.split('\n').length;
    return `文件已成功写入: ${absPath}\n大小: ${(stat.size / 1024).toFixed(1)} KB | 行数: ${lines}`;
  } catch (err) {
    if (err.code === 'EACCES') {
      return `错误: 没有权限写入文件: ${absPath}`;
    }
    return `错误: 写入文件失败: ${err.message}`;
  }
};
