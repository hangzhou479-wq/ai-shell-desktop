/**
 * 插件工具集
 * 通过外部服务扩展 DeepSeek 做不到的事
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// HTTP 请求
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
      timeout: 30000,
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  // 音频转文字（使用 Groq 免费 Whisper API）
  transcribeAudio: async function({ file_path, language = 'zh' }) {
    const absPath = path.resolve(file_path);
    if (!fs.existsSync(absPath)) return `文件不存在: ${absPath}`;

    const key = process.env.GROQ_API_KEY;
    if (!key) {
      return `音频转录需要 Groq API Key（免费）:
1. 访问 https://console.groq.com/keys
2. 注册（支持 Google/GitHub 登录）
3. 创建 API Key
4. export GROQ_API_KEY="gsk_xxx"

Groq 提供免费的 Whisper 模型，支持多种语言。`;
    }

    try {
      const formData = new (require('form-data'))();
      formData.append('file', fs.createReadStream(absPath));
      formData.append('model', 'whisper-large-v3');
      formData.append('language', language);

      // 用 curl 发送 multipart（避免 form-data 依赖问题）
      const result = execSync(
        `curl -s -X POST "https://api.groq.com/openai/v1/audio/transcriptions" ` +
        `-H "Authorization: Bearer ${key}" ` +
        `-F "file=@${absPath}" ` +
        `-F "model=whisper-large-v3" ` +
        `-F "language=${language}"`,
        { encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
      );
      const j = JSON.parse(result);
      return j.text ? `转录结果:\n${j.text}` : `转录失败: ${JSON.stringify(j)}`;
    } catch (err) {
      return `转录失败: ${err.message}`;
    }
  },

  // 生成 IDE 配置（VS Code）
  ideConfig: async function({ type, directory }) {
    const cwd = directory ? path.resolve(directory) : process.cwd();
    const vscodeDir = path.join(cwd, '.vscode');

    try {
      if (!fs.existsSync(vscodeDir)) fs.mkdirSync(vscodeDir);

      switch (type) {
        case 'debug-node': {
          const launch = {
            version: '0.2.0',
            configurations: [{
              type: 'node', request: 'launch', name: 'Launch Program',
              skipFiles: ['<node_internals>/**'],
              program: '${workspaceFolder}/index.js',
            }],
          };
          fs.writeFileSync(path.join(vscodeDir, 'launch.json'), JSON.stringify(launch, null, 2));
          return `已生成 VS Code Node.js 调试配置: .vscode/launch.json\n在 VS Code 中按 F5 即可开始调试`;
        }
        case 'tasks': {
          const tasks = {
            version: '2.0.0',
            tasks: [
              { label: 'build', type: 'shell', command: 'npm run build', group: { kind: 'build', isDefault: true } },
              { label: 'test', type: 'shell', command: 'npm test', group: { kind: 'test', isDefault: true } },
              { label: 'dev', type: 'shell', command: 'npm run dev', group: { kind: 'none' } },
            ],
          };
          fs.writeFileSync(path.join(vscodeDir, 'tasks.json'), JSON.stringify(tasks, null, 2));
          return `已生成 VS Code 任务配置: .vscode/tasks.json\nCmd+Shift+B 构建, Cmd+Shift+T 测试`;
        }
        case 'settings': {
          const settings = {
            'editor.formatOnSave': true,
            'editor.tabSize': 2,
            'files.exclude': { 'node_modules': true, '.git': true },
            'editor.defaultFormatter': 'esbenp.prettier-vscode',
          };
          fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(settings, null, 2));
          return `已生成 VS Code 项目设置: .vscode/settings.json`;
        }
        case 'extensions': {
          const exts = {
            recommendations: [
              'dbaeumer.vscode-eslint', 'esbenp.prettier-vscode',
              'ms-vscode.vscode-typescript-next', 'github.copilot',
            ],
          };
          fs.writeFileSync(path.join(vscodeDir, 'extensions.json'), JSON.stringify(exts, null, 2));
          return `已生成 VS Code 推荐扩展: .vscode/extensions.json`;
        }
        default:
          return `支持的类型: debug-node, tasks, settings, extensions`;
      }
    } catch (err) {
      return `生成失败: ${err.message}`;
    }
  },

  // 错误诊断增强（解析 stack trace）
  debugAnalyze: async function({ error_output, file }) {
    let errorText = error_output || '';
    if (file) {
      try { errorText = fs.readFileSync(path.resolve(file), 'utf-8'); } catch(e) {}
    }

    if (!errorText.trim()) return '请提供错误输出或日志文件路径';

    const analysis = [];
    const lines = errorText.split('\n');

    // 解析常见错误模式
    for (const line of lines) {
      // JS/TS 错误
      const jsMatch = line.match(/(\S+Error):\s*(.+)/);
      if (jsMatch) analysis.push(`错误类型: ${jsMatch[1]}\n错误信息: ${jsMatch[2]}`);

      // Python 错误
      const pyMatch = line.match(/(\w+Error):\s*(.+)/);
      if (pyMatch) analysis.push(`Python 错误: ${pyMatch[1]}: ${pyMatch[2]}`);

      // 堆栈位置
      const locMatch = line.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
      if (locMatch) analysis.push(`位置: ${locMatch[1]}\n文件: ${locMatch[2]}\n行号: ${locMatch[3]}`);

      const fileMatch = line.match(/File\s+"(.+)",\s*line\s+(\d+)/);
      if (fileMatch) analysis.push(`文件: ${fileMatch[1]}\n行号: ${fileMatch[2]}`);
    }

    if (analysis.length === 0) {
      return `无法自动解析错误。请将以下输出交给 AI 分析:\n${errorText.slice(0, 2000)}`;
    }

    return `错误诊断:\n${analysis.join('\n\n')}\n\n原始输出:\n${errorText.slice(0, 1500)}`;
  },

  // 部署脚本生成
  deployScript: async function({ target, directory }) {
    const cwd = directory ? path.resolve(directory) : process.cwd();
    const pkgPath = path.join(cwd, 'package.json');
    const hasNode = fs.existsSync(pkgPath);
    let name = 'app';
    try { name = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).name || 'app'; } catch(e) {}

    const scripts = {
      'docker': `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nEXPOSE 3000\nCMD ["node", "index.js"]`,
      'docker-compose': `version: '3'\nservices:\n  ${name}:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      - NODE_ENV=production`,
      'vercel': `{ "buildCommand": "npm run build", "outputDirectory": "dist", "framework": null }`,
      'pm2': `module.exports = { apps: [{ name: '${name}', script: 'index.js', instances: 1, env: { NODE_ENV: 'production' } }] };`,
    };

    const t = scripts[target];
    if (!t) return `支持: docker, docker-compose, vercel, pm2`;

    const fnames = { docker: 'Dockerfile', 'docker-compose': 'docker-compose.yml', vercel: 'vercel.json', pm2: 'ecosystem.config.js' };
    const fname = path.join(cwd, fnames[target]);
    fs.writeFileSync(fname, t);
    return `已生成 ${target} 部署配置: ${fname}`;
  },
};
