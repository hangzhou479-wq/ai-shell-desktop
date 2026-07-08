/**
 * 终端颜色工具
 * 零依赖 ANSI 颜色码封装，替代 chalk
 */
const ansi = (code) => (text) => `\x1b[${code}m${text}\x1b[0m`;

const colors = {
  reset: ansi(0),
  bold: ansi(1),
  dim: ansi(2),
  italic: ansi(3),
  underline: ansi(4),

  black: ansi(30),
  red: ansi(31),
  green: ansi(32),
  yellow: ansi(33),
  blue: ansi(34),
  magenta: ansi(35),
  cyan: ansi(36),
  white: ansi(37),
  gray: ansi(90),

  bgRed: ansi(41),
  bgGreen: ansi(42),
  bgYellow: ansi(43),
  bgBlue: ansi(44),
  bgCyan: ansi(46),

  // 复合样式
  header: (text) => `\x1b[1m\x1b[36m${text}\x1b[0m`,
  success: (text) => `\x1b[32m✓ ${text}\x1b[0m`,
  error: (text) => `\x1b[31m✗ ${text}\x1b[0m`,
  warn: (text) => `\x1b[33m⚠ ${text}\x1b[0m`,
  info: (text) => `\x1b[36mℹ ${text}\x1b[0m`,

  // 辅助方法
  strip: (text) => text.replace(/\x1b\[\d+m/g, ''),
};

module.exports = colors;
