/**
 * 项目管理工具：脚手架、依赖管理
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEMPLATES = {
  'node-basic': {
    files: {
      'package.json': '{"name":"my-app","version":"1.0.0","main":"index.js","scripts":{"start":"node index.js","dev":"node --watch index.js"}}',
      'index.js': "// 入口文件\nconsole.log('Hello from my-app!');\n",
      '.gitignore': 'node_modules/\n.env\n*.log\n',
      'README.md': '# my-app\n\nA Node.js project.\n',
    },
    install: 'npm install',
  },
  'react-vite': {
    command: 'npm create vite@latest . -- --template react 2>&1',
  },
  'python-basic': {
    files: {
      'main.py': '"""主模块"""\n\ndef main():\n    print("Hello!")\n\nif __name__ == "__main__":\n    main()\n',
      'requirements.txt': '',
      '.gitignore': '__pycache__/\n*.pyc\n.env\nvenv/\n',
      'README.md': '# Python Project\n',
    },
  },
};

module.exports = {
  projectInit: async function({ template, name, directory }) {
    const tmpl = template || 'node-basic';
    const projName = name || 'my-project';
    const parentDir = directory ? path.resolve(directory) : process.cwd();
    const projDir = path.join(parentDir, projName);

    if (fs.existsSync(projDir)) {
      return `目录已存在: ${projDir}`;
    }

    const t = TEMPLATES[tmpl];
    if (!t) {
      return `未知模板: ${tmpl}\n可用: ${Object.keys(TEMPLATES).join(', ')}`;
    }

    try {
      // 创建目录
      fs.mkdirSync(projDir, { recursive: true });

      // 创建文件
      if (t.files) {
        for (const [fp, content] of Object.entries(t.files)) {
          const fullPath = path.join(projDir, fp);
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(fullPath, content, 'utf-8');
        }
      }

      // 执行命令（如 npm create）
      if (t.command) {
        execSync(t.command, { cwd: projDir, encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
      }

      // 安装依赖
      if (t.install) {
        execSync(t.install, { cwd: projDir, encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
      }

      return `✅ 项目已创建: ${projDir}\n模板: ${tmpl}\n\n文件列表:\n${fs.readdirSync(projDir).map(f => '  - ' + f).join('\n')}`;
    } catch (err) {
      return `创建失败: ${err.message}`;
    }
  },

  projectInstall: async function({ directory }) {
    const cwd = directory ? path.resolve(directory) : process.cwd();

    try {
      let result = '';

      // npm
      if (fs.existsSync(path.join(cwd, 'package.json'))) {
        const out = execSync('npm install 2>&1', { cwd, encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
        result += 'npm install: ✅\n' + out.slice(-500) + '\n';
      }

      // pip
      if (fs.existsSync(path.join(cwd, 'requirements.txt'))) {
        const out = execSync('pip3 install -r requirements.txt 2>&1', { cwd, encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
        result += 'pip install: ✅\n' + out.slice(-300) + '\n';
      }

      return result || '未找到 package.json 或 requirements.txt';
    } catch (err) {
      return `安装失败: ${err.stderr || err.message}`;
    }
  },

  projectTree: async function({ directory, max_depth = 3 }) {
    const cwd = directory ? path.resolve(directory) : process.cwd();
    const skip = new Set(['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', 'target', '.cache']);

    let output = '';
    function walk(dir, prefix, depth) {
      if (depth > max_depth) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      const items = entries.filter(e => !e.name.startsWith('.') || e.name === '.env' || e.name === '.env.example');

      for (let i = 0; i < items.length; i++) {
        const e = items[i];
        const isLast = i === items.length - 1;
        const line = prefix + (isLast ? '└── ' : '├── ') + e.name;

        if (output.split('\n').length > 80) { output += '\n...（已截断）'; return; }
        output += line + (e.isDirectory() ? '/' : '') + '\n';

        if (e.isDirectory() && !skip.has(e.name)) {
          walk(path.join(dir, e.name), prefix + (isLast ? '    ' : '│   '), depth + 1);
        }
      }
    }

    walk(cwd, '', 0);
    return `项目结构 (${cwd}):\n${output}`;
  },
};
