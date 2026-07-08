/**
 * 联网搜索 + 网页抓取工具
 * 自动选择可用的搜索引擎
 */
const https = require('https');
const http = require('http');

function httpGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', ...opts.headers },
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return httpGet(res.headers.location, opts).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = {
  webSearch: async function({ query, max_results = 8 }) {
    const q = encodeURIComponent(query);
    const results = [];

    // 尝试 Bing 搜索
    try {
      const html = await httpGet(`https://www.bing.com/search?q=${q}&count=${max_results}`, {
        headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' },
      });

      // 解析 Bing 结果
      const matches = html.matchAll(/<li class="b_algo"[^>]*>[\s\S]*?<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi);
      for (const m of matches) {
        if (results.length >= max_results) break;
        const title = (m[2] || '').replace(/<[^>]*>/g, '').trim();
        const snippet = (m[3] || '').replace(/<[^>]*>/g, '').trim();
        if (title && m[1]) {
          results.push({ title, url: m[1], snippet });
        }
      }
    } catch (e) { /* Bing 失败，下面尝试备用 */ }

    // 备用：DuckDuckGo
    if (results.length === 0) {
      try {
        const html = await httpGet(`https://html.duckduckgo.com/html/?q=${q}`);
        const matches = html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi);
        for (const m of matches) {
          if (results.length >= max_results) break;
          const title = (m[2] || '').replace(/<[^>]*>/g, '').trim();
          const snippet = (m[3] || '').replace(/<[^>]*>/g, '').trim();
          let url = m[1];
          const uddg = url.match(/uddg=(https?[^&]*)/);
          if (uddg) url = decodeURIComponent(uddg[1]);
          if (title && url) results.push({ title, url, snippet });
        }
      } catch (e) { /* 忽略 */ }
    }

    if (results.length === 0) {
      return `搜索完成，但未找到匹配结果。建议:
1. 简化搜索词
2. 直接使用 web_fetch 抓取已知网页
3. 搜索结果可能需要更具体的查询词`;
    }

    let output = `🔍 "${query}" 搜索结果:\n\n`;
    results.forEach((r, i) => {
      output += `${i + 1}. **${r.title}**\n`;
      output += `   ${r.url}\n`;
      if (r.snippet) output += `   ${r.snippet.slice(0, 200)}\n`;
      output += '\n';
    });

    return output;
  },

  webFetch: async function({ url, max_length = 5000 }) {
    try {
      const html = await httpGet(url);

      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > max_length) {
        text = text.slice(0, max_length) + '...（已截断）';
      }

      if (!text || text.length < 20) {
        return `无法从该网页提取有效内容（可能需要 JS 渲染或网站屏蔽了爬虫）`;
      }

      return `📄 ${url}:\n\n${text}`;
    } catch (err) {
      return `抓取失败: ${err.message}`;
    }
  },
};
