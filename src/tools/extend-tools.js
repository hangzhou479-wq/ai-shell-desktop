/**
 * 扩展工具集
 * 文件分享、图片生成、音视频处理
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

module.exports = {
  // 文件分享 — 启动临时 HTTP 服务器分享文件
  fileShare: async function({ file_path, port = 8888 }) {
    const absPath = path.resolve(file_path);
    if (!fs.existsSync(absPath)) return `文件不存在: ${absPath}`;

    const stat = fs.statSync(absPath);
    const fileName = path.basename(absPath);
    const mimeTypes = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.pdf': 'application/pdf', '.zip': 'application/zip', '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    const ext = path.extname(absPath).toLowerCase();
    const mime = mimeTypes[ext] || 'application/octet-stream';

    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(absPath).pipe(res);
      });

      server.listen(port, () => {
        const ip = getLocalIP();
        const url = `http://${ip}:${port}`;
        resolve(`📤 文件分享服务已启动\n文件: ${fileName} (${(stat.size/1024).toFixed(1)} KB)\n下载链接: ${url}\n\n局域网内其他设备可直接访问下载。\n关闭服务: 在终端执行 kill $(lsof -ti:${port})`);
      });

      server.on('error', () => resolve(`端口 ${port} 已被占用，换个端口试试`));

      // 5分钟后自动关闭
      setTimeout(() => { server.close(); }, 300000);
    });
  },

  // 图片生成 — 使用 Pollinations.ai 免费 API
  generateImage: async function({ prompt, output_path, width = 1024, height = 1024 }) {
    const absPath = path.resolve(output_path || `generated-${Date.now()}.png`);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
      // Pollinations.ai 免费，无需 API Key
      const encoded = encodeURIComponent(prompt);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true`;

      const data = await httpGet(url, { binary: true });
      fs.writeFileSync(absPath, data);

      const stat = fs.statSync(absPath);
      return `✅ 图片已生成: ${absPath}\n大小: ${(stat.size/1024).toFixed(1)} KB\n尺寸: ${width}x${height}\n提示词: ${prompt}`;
    } catch (err) {
      // 备用：提供本地生成方案
      return `图片生成失败: ${err.message}\n\n免费图片生成方案:\n1. Pollinations.ai (无需 Key，已内置)\n2. 如需更高质量，可配置 Stability API:\n   export STABILITY_API_KEY="sk-xxx"\n   然后使用此工具`;
    }
  },

  // 视频处理 — 使用 FFmpeg
  videoProcess: async function({ file_path, action, options = '' }) {
    const absPath = path.resolve(file_path);
    if (!fs.existsSync(absPath)) return `文件不存在: ${absPath}`;

    // 检查 FFmpeg
    try {
      execSync('ffmpeg -version', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    } catch (e) {
      return '需要 FFmpeg。安装:\nMac: brew install ffmpeg\nWin: winget install ffmpeg';
    }

    const ext = path.extname(absPath);
    const base = absPath.slice(0, -ext.length);
    const outPath = base + '_processed' + (action === 'gif' ? '.gif' : '.mp4');

    const commands = {
      'compress': `ffmpeg -i "${absPath}" -vcodec libx264 -crf 28 "${outPath}" -y`,
      'resize': `ffmpeg -i "${absPath}" -vf scale=1280:720 "${outPath}" -y`,
      'extract-audio': `ffmpeg -i "${absPath}" -q:a 0 -map a "${base}_audio.mp3" -y`,
      'gif': `ffmpeg -i "${absPath}" -vf "fps=10,scale=480:-1" "${outPath}" -y`,
      'trim': `ffmpeg -i "${absPath}" ${options || '-ss 00:00:00 -t 00:00:30'} -c copy "${outPath}" -y`,
      'concat': `ffmpeg -f concat -safe 0 -i "${absPath}" -c copy "${base}_merged.mp4" -y`,
    };

    const cmd = commands[action];
    if (!cmd) return `支持的操作: compress, resize, extract-audio, gif, trim, concat`;

    try {
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
      const stat = fs.statSync(outPath);
      return `✅ 视频处理完成: ${outPath}\n操作: ${action}\n大小: ${(stat.size/1024).toFixed(1)} KB`;
    } catch (err) {
      return `处理失败: ${err.stderr || err.message}`;
    }
  },

  // 音频处理
  audioProcess: async function({ file_path, action, options = '' }) {
    const absPath = path.resolve(file_path);
    if (!fs.existsSync(absPath)) return `文件不存在: ${absPath}`;

    try {
      execSync('ffmpeg -version', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    } catch (e) {
      return '需要 FFmpeg。Mac: brew install ffmpeg';
    }

    const ext = path.extname(absPath);
    const base = absPath.slice(0, -ext.length);

    const commands = {
      'to-mp3': `ffmpeg -i "${absPath}" -codec:a libmp3lame -qscale:a 2 "${base}.mp3" -y`,
      'to-wav': `ffmpeg -i "${absPath}" "${base}.wav" -y`,
      'speed': `ffmpeg -i "${absPath}" -filter:a "atempo=${options || 1.5}" "${base}_speed.mp3" -y`,
      'trim': `ffmpeg -i "${absPath}" ${options || '-ss 00:00:00 -t 00:01:00'} -c copy "${base}_trimmed${ext}" -y`,
      'volume': `ffmpeg -i "${absPath}" -filter:a "volume=${options || 2.0}" "${base}_louder${ext}" -y`,
      'merge': `ffmpeg -i "${absPath}" ${options ? '-i "' + path.resolve(options) + '"' : ''} -filter_complex amerge -ac 2 "${base}_merged.mp3" -y`,
    };

    const cmd = commands[action];
    if (!cmd) return `支持: to-mp3, to-wav, speed, trim, volume, merge`;

    try {
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
      return `✅ 音频处理完成\n操作: ${action}`;
    } catch (err) {
      return `处理失败: ${err.stderr || err.message}`;
    }
  },
};

function httpGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 30000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(opts.binary ? buf : buf.toString('utf-8'));
      });
    });
    req.on('error', reject);
  });
}

function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}
