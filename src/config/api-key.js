/**
 * API Key 管理
 * 读取优先级：环境变量 > 配置文件 > 交互式输入
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const platform = require('../utils/platform');
const colors = require('../terminal/colors');

/**
 * 尝试从多个来源获取 API Key
 */
function getApiKey(config) {
  // 1. 环境变量
  if (process.env.DEEPSEEK_API_KEY) {
    return { key: process.env.DEEPSEEK_API_KEY, source: '环境变量 DEEPSEEK_API_KEY' };
  }

  // 2. 配置文件
  if (config && config.apiKey) {
    return { key: config.apiKey, source: '配置文件' };
  }

  // 3. 单独的 key 文件 (.ai-shell/key)
  const keyFile = path.join(platform.getConfigDir(), 'key');
  if (fs.existsSync(keyFile)) {
    try {
      const key = fs.readFileSync(keyFile, 'utf-8').trim();
      if (key && key.startsWith('sk-')) {
        return { key, source: '密钥文件' };
      }
    } catch (err) { /* 忽略 */ }
  }

  return { key: null, source: null };
}

/**
 * 交互式引导用户输入 API Key
 */
async function promptApiKey() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log(colors.header('═══════════════ 配置 API Key ═══════════════'));
  console.log('');
  console.log('  在使用 AI-Shell 之前，需要配置 DeepSeek API Key。');
  console.log('');
  console.log(colors.info('获取方式：'));
  console.log(`  1. 访问 ${colors.cyan('https://platform.deepseek.com')}`);
  console.log('  2. 注册/登录账号');
  console.log('  3. 在 "API Keys" 页面创建新的 API Key');
  console.log('  4. 复制 Key（以 sk- 开头）');
  console.log('');
  console.log(colors.warn('API Key 只会保存在本地，不会上传到任何服务器'));
  console.log('');

  return new Promise((resolve) => {
    rl.question(colors.bold('请输入你的 DeepSeek API Key: '), (answer) => {
      rl.close();
      const key = answer.trim();
      if (key) {
        // 保存到 key 文件
        const configDir = platform.getConfigDir();
        platform.ensureDir(configDir);
        const keyFile = path.join(configDir, 'key');
        fs.writeFileSync(keyFile, key, { mode: 0o600 });
        console.log('');
        console.log(colors.success(`API Key 已保存到 ${keyFile}`));
        resolve(key);
      } else {
        console.log('');
        console.log(colors.warn('未输入 API Key。你可以稍后运行 ai-shell --setup 重新配置'));
        resolve(null);
      }
    });
  });
}

module.exports = { getApiKey, promptApiKey };
