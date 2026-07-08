/**
 * HTTP 请求封装
 * 使用 Node.js 内置 https 模块，零外部依赖
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * 发送 HTTPS 请求
 * @param {Object} config - 配置对象 { apiBaseUrl, apiKey, timeout, proxy }
 * @param {string} path - 请求路径
 * @param {Object} body - 请求体
 * @param {boolean} stream - 是否流式请求
 * @returns {Promise<http.IncomingMessage>}
 */
function request(config, path, body, stream = false) {
  const url = new URL(config.apiBaseUrl || 'https://api.deepseek.com');
  const isHTTPS = url.protocol === 'https:';
  const httpModule = isHTTPS ? https : http;

  const postData = JSON.stringify(body);

  const options = {
    hostname: url.hostname,
    port: url.port || (isHTTPS ? 443 : 80),
    path: path,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': stream ? 'text/event-stream' : 'application/json',
      'User-Agent': 'AI-Shell/1.0',
    },
    timeout: config.timeout || 120000,
  };

  return new Promise((resolve, reject) => {
    const req = httpModule.request(options, (res) => {
      // 检查状态码
      if (res.statusCode === 401) {
        const err = new Error('API Key 无效。请检查配置或运行 ai-shell --setup 重新设置');
        err.code = 'AUTH_ERROR';
        return reject(err);
      }
      if (res.statusCode === 429) {
        const err = new Error('请求频率过高，请稍后重试');
        err.code = 'RATE_LIMIT';
        return reject(err);
      }
      if (res.statusCode === 402) {
        const err = new Error('账户余额不足。请前往 platform.deepseek.com 充值');
        err.code = 'INSUFFICIENT_FUNDS';
        return reject(err);
      }
      if (res.statusCode && res.statusCode >= 500) {
        // 读取错误体
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let detail = '';
          try { detail = JSON.parse(data).error?.message || ''; } catch (e) {}
          const err = new Error(`DeepSeek 服务器错误 (${res.statusCode})${detail ? ': ' + detail : ''}`);
          err.code = 'SERVER_ERROR';
          reject(err);
        });
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let detail = '';
          try { detail = JSON.parse(data).error?.message || ''; } catch (e) {}
          const err = new Error(`请求错误 (${res.statusCode})${detail ? ': ' + detail : ''}`);
          err.code = 'REQUEST_ERROR';
          reject(err);
        });
        return;
      }

      resolve(res);
    });

    req.on('error', (err) => {
      if (err.code === 'ENOTFOUND') {
        reject(new Error(`无法访问 ${config.apiBaseUrl}，请检查网络连接`));
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
        reject(new Error(`连接超时，请检查网络或尝试使用代理。可设置环境变量 AI_SHELL_PROXY`));
      } else {
        reject(err);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`请求超时 (${config.timeout / 1000}s)。可设置环境变量 AI_SHELL_TIMEOUT 修改`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 发送带重试的请求
 */
async function requestWithRetry(config, path, body, stream = false) {
  const maxRetries = config.maxRetries || 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await request(config, path, body, stream);
    } catch (err) {
      lastError = err;

      // 认证/余额/请求错误不重试
      if (['AUTH_ERROR', 'INSUFFICIENT_FUNDS', 'REQUEST_ERROR'].includes(err.code)) {
        throw err;
      }

      // 速率限制重试
      if (err.code === 'RATE_LIMIT') {
        const delay = 10000;
        if (attempt < maxRetries) {
          console.error(`\x1b[33m[速率限制] ${delay / 1000}s 后重试...\x1b[0m`);
          await sleep(delay);
        }
        continue;
      }

      // 服务器错误和网络错误重试
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
        console.error(`\x1b[33m[请求失败] ${err.message}，${delay / 1000}s 后重试 (${attempt}/${maxRetries})\x1b[0m`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * 检查 API 连接
 */
async function checkConnection(config) {
  try {
    const res = await request(config, '/v1/chat/completions', {
      model: config.model || 'deepseek-chat',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      stream: false,
    });

    // 读取并丢弃响应
    let data = '';
    res.on('data', chunk => data += chunk);
    await new Promise((resolve) => res.on('end', resolve));

    const parsed = JSON.parse(data);
    if (parsed.error) {
      return { ok: false, error: parsed.error.message };
    }
    return { ok: true, model: parsed.model };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { request, requestWithRetry, checkConnection };
