/**
 * 文件/目录元信息工具
 */
const fs = require('fs');
const path = require('path');

module.exports = async function fileInfo({ path: filePath }) {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    return `错误: 路径不存在: ${absPath}`;
  }

  try {
    const stat = fs.statSync(absPath);

    const info = {
      path: absPath,
      name: path.basename(absPath),
      type: stat.isDirectory() ? '目录' : stat.isFile() ? '文件' : stat.isSymbolicLink() ? '符号链接' : '其他',
      size: stat.size,
      sizeFormatted: stat.size > 1024 * 1024
        ? `${(stat.size / 1024 / 1024).toFixed(2)} MB`
        : stat.size > 1024
          ? `${(stat.size / 1024).toFixed(2)} KB`
          : `${stat.size} B`,
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString(),
      accessed: stat.atime.toISOString(),
      permissions: stat.mode.toString(8).slice(-3),
      isReadable: true,
      isWritable: true,
    };

    // 检查权限
    try {
      fs.accessSync(absPath, fs.constants.R_OK);
    } catch (err) {
      info.isReadable = false;
    }
    try {
      fs.accessSync(absPath, fs.constants.W_OK);
    } catch (err) {
      info.isWritable = false;
    }

    // 对文本文件统计行数
    if (stat.isFile() && stat.size < 10 * 1024 * 1024) {
      const ext = path.extname(absPath).toLowerCase();
      const textExts = new Set([
        '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.go', '.rs', '.java',
        '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt', '.scala',
        '.html', '.css', '.scss', '.less', '.xml', '.json', '.yaml', '.yml',
        '.toml', '.ini', '.cfg', '.conf', '.md', '.txt', '.sh', '.bash',
        '.zsh', '.fish', '.ps1', '.bat', '.sql', '.graphql', '.vue', '.svelte',
        '.env', '.gitignore', '.dockerignore', '.editorconfig',
      ]);

      if (textExts.has(ext) || ext === '' || !ext) {
        try {
          const content = fs.readFileSync(absPath, 'utf-8');
          const lines = content.split('\n');
          info.lineCount = lines.length;

          // 检测编码问题
          const hasBOM = content.charCodeAt(0) === 0xFEFF;
          info.encoding = hasBOM ? 'UTF-8 BOM' : 'UTF-8';

          // 检测是否有二进制内容
          let binaryChars = 0;
          for (let i = 0; i < Math.min(content.length, 1000); i++) {
            if (content.charCodeAt(i) === 0) binaryChars++;
          }
          if (binaryChars > 0) {
            info.likelyBinary = true;
          }
        } catch (err) {
          info.readError = err.message;
        }
      }
    }

    // 格式化输出
    let output = `路径: ${info.path}\n`;
    output += `名称: ${info.name}\n`;
    output += `类型: ${info.type}\n`;
    output += `大小: ${info.sizeFormatted}\n`;
    if (info.lineCount !== undefined) {
      output += `行数: ${info.lineCount}\n`;
    }
    output += `权限: ${info.permissions} (R:${info.isReadable ? '✓' : '✗'} W:${info.isWritable ? '✓' : '✗'})\n`;
    output += `创建: ${new Date(info.created).toLocaleString('zh-CN')}\n`;
    output += `修改: ${new Date(info.modified).toLocaleString('zh-CN')}\n`;

    return output;
  } catch (err) {
    return `错误: 获取文件信息失败: ${err.message}`;
  }
};
