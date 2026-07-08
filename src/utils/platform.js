/**
 * 跨平台适配工具
 */
const os = require('os');
const path = require('path');

const platform = {
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',

  /** 获取操作系统名称 */
  getOSName() {
    if (this.isMac) return 'macOS';
    if (this.isWindows) return 'Windows';
    if (this.isLinux) return 'Linux';
    return process.platform;
  },

  /** 获取 CPU 架构 */
  getArch() {
    const arch = os.arch();
    if (arch === 'arm64') return 'ARM64 (Apple Silicon)';
    if (arch === 'x64') return 'x64 (Intel/AMD)';
    return arch;
  },

  /** 获取 Node.js 版本 */
  getNodeVersion() {
    return process.version;
  },

  /** 获取配置目录路径 */
  getConfigDir() {
    const home = os.homedir();
    return path.join(home, '.ai-shell');
  },

  /** 获取配置文件路径 */
  getConfigPath() {
    return path.join(this.getConfigDir(), 'config.json');
  },

  /** 获取 MCP 配置路径 */
  getMcpConfigPath() {
    return path.join(this.getConfigDir(), 'mcp.json');
  },

  /** 获取会话历史目录 */
  getSessionsDir() {
    return path.join(this.getConfigDir(), 'sessions');
  },

  /** 确保目录存在 */
  ensureDir(dirPath) {
    const fs = require('fs');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  },

  /** 获取临时目录 */
  getTempDir() {
    return os.tmpdir();
  },

  /** 归一化路径（统一使用 /） */
  normalizePath(p) {
    return p.split(path.sep).join('/');
  },
};

module.exports = platform;
