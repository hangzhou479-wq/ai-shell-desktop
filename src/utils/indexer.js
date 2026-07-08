/**
 * 项目文件索引器
 * 快速扫描项目文件，缓存元信息，支持模糊搜索
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const platform = require('./platform');

class ProjectIndexer {
  constructor(rootDir) {
    this.rootDir = rootDir || process.cwd();
    this.index = null;
    this.indexPath = null;
  }

  /**
   * 构建项目文件索引
   * @param {Object} opts - { force: 是否强制重建, maxFiles: 最大索引文件数 }
   */
  async build(opts = {}) {
    const { force = false, maxFiles = 5000 } = opts;

    // 索引文件路径
    const hash = crypto.createHash('md5').update(this.rootDir).digest('hex').slice(0, 8);
    const indexDir = path.join(platform.getConfigDir(), 'index');
    platform.ensureDir(indexDir);
    this.indexPath = path.join(indexDir, `project-${hash}.json`);

    // 非强制模式下，检查缓存（5 分钟内有效）
    if (!force && fs.existsSync(this.indexPath)) {
      const stat = fs.statSync(this.indexPath);
      if (Date.now() - stat.mtimeMs < 5 * 60 * 1000) {
        try {
          this.index = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
          return this.index;
        } catch (err) { /* 缓存损坏，重建 */ }
      }
    }

    // 扫描文件
    const files = [];
    const ignoreDirs = new Set([
      'node_modules', '.git', '__pycache__', '.next', 'dist', 'build',
      'target', '.cache', '.idea', '.vscode', 'coverage', '.nyc_output',
      'venv', '.venv', 'env', '.env', 'vendor', 'bower_components',
    ]);
    const ignoreExts = new Set([
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.bmp',
      '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.webm',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib', '.wasm',
      '.pdf', '.doc', '.docx',
      '.woff', '.woff2', '.ttf', '.eot',
    ]);

    this._walk(this.rootDir, '', files, ignoreDirs, ignoreExts, maxFiles, 0);

    // 按类型分组统计
    const byExt = {};
    for (const f of files) {
      const ext = f.ext || '(无扩展名)';
      byExt[ext] = (byExt[ext] || 0) + 1;
    }

    this.index = {
      root: this.rootDir,
      builtAt: Date.now(),
      totalFiles: files.length,
      byExtension: byExt,
      files: files.slice(0, 2000), // 最多保存 2000 个文件详情
    };

    // 保存缓存
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');

    return this.index;
  }

  _walk(dir, relativePath, results, ignoreDirs, ignoreExts, maxFiles, depth) {
    if (results.length >= maxFiles || depth > 12) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.env.example') continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          this._walk(fullPath, relPath, results, ignoreDirs, ignoreExts, maxFiles, depth + 1);
        }
        continue;
      }

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ignoreExts.has(ext)) continue;

        let stat;
        try { stat = fs.statSync(fullPath); } catch (err) { continue; }

        // 跳过大于 1MB 的文件（索引中不记录详情）
        if (stat.size > 1024 * 1024) continue;

        const entry = {
          path: relPath,
          name: entry.name,
          ext,
          size: stat.size,
          modified: stat.mtimeMs,
        };

        // 对文本文件提取更多信息
        if (this._isTextFile(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            entry.lines = content.split('\n').length;
            entry.preview = content.slice(0, 200).replace(/\n/g, '\\n');
          } catch (err) {
            // 跳过
          }
        }

        results.push(entry);
      }
    }
  }

  _isTextFile(ext) {
    const textExts = new Set([
      '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
      '.py', '.rb', '.go', '.rs', '.java', '.scala', '.kt',
      '.c', '.cpp', '.h', '.hpp', '.cs', '.swift',
      '.html', '.css', '.scss', '.less', '.sass',
      '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg',
      '.md', '.txt', '.rst', '.adoc',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat',
      '.sql', '.graphql', '.prisma',
      '.vue', '.svelte', '.astro',
      '.env', '.gitignore', '.dockerignore',
      '.jsx', '.tsx',
    ]);
    return textExts.has(ext) || ext === '';
  }

  /**
   * 搜索文件（模糊匹配）
   */
  search(query, maxResults = 20) {
    if (!this.index) return [];

    const q = query.toLowerCase();
    const results = [];

    for (const file of (this.index.files || [])) {
      if (file.path.toLowerCase().includes(q) ||
          file.name.toLowerCase().includes(q)) {
        results.push(file);
        if (results.length >= maxResults) break;
      }
    }

    return results;
  }

  /**
   * 获取项目统计
   */
  getStats() {
    if (!this.index) return null;
    return {
      root: this.index.root,
      totalFiles: this.index.totalFiles,
      builtAt: this.index.builtAt,
      byExtension: this.index.byExtension,
    };
  }
}

module.exports = ProjectIndexer;
