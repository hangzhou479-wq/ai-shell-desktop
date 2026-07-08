/**
 * 图片分析工具
 * 使用通义千问 VL 免费 API 识别图片内容
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

function base64Image(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' }[ext] || 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function callVisionAPI(apiUrl, apiKey, model, imageB64, prompt) {
  const body = JSON.stringify({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageB64 } },
        { type: 'text', text: prompt },
      ],
    }],
    max_tokens: 1000,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(j.error.message || 'API 错误'));
          resolve(j.choices?.[0]?.message?.content || '无响应');
        } catch (e) {
          reject(new Error('响应解析失败'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function imageAnalyze({ path: filePath, question }) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) return `错误: 文件不存在: ${absPath}`;

  const ext = path.extname(absPath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) {
    return `错误: 不支持的图片格式 (${ext})，支持: PNG, JPG, GIF, WebP, BMP`;
  }

  const stat = fs.statSync(absPath);
  if (stat.size > 10 * 1024 * 1024) {
    return '错误: 图片过大（超过 10MB）';
  }

  // 检查是否配置了视觉 API Key
  const visionKey = process.env.VISION_API_KEY || process.env.DASHSCOPE_API_KEY;
  const visionUrl = process.env.VISION_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const visionModel = process.env.VISION_MODEL || 'qwen-vl-plus';

  if (!visionKey) {
    return `图片分析需要配置视觉 API。支持以下免费方案：

**方案 1：通义千问 VL（推荐，国内直连）**
1. 访问 https://dashscope.console.aliyun.com
2. 用阿里云账号登录（支付宝扫码即可）
3. 开通"模型服务灵积" → 获取 API Key
4. 设置环境变量: export DASHSCOPE_API_KEY="sk-xxx"

**方案 2：Google Gemini（免费额度大）**
1. 访问 https://aistudio.google.com/apikey
2. 创建 API Key
3. 设置: export VISION_API_KEY="xxx" VISION_API_URL="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" VISION_MODEL="gemini-1.5-flash"

配置后即可使用 image_analyze 工具识别图片。`;
  }

  try {
    const imageB64 = base64Image(absPath);
    const prompt = question || '请详细描述这张图片的内容，包括其中的文字、物体、人物、场景等所有细节。';

    const result = await callVisionAPI(visionUrl, visionKey, visionModel, imageB64, prompt);

    return `📷 图片分析结果 (${path.basename(absPath)}):\n\n${result}`;
  } catch (err) {
    return `图片分析失败: ${err.message}`;
  }
};
