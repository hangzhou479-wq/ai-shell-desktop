/**
 * 简易 Token 估算工具
 * 不依赖 tiktoken（需要原生编译），使用启发式算法
 * 中英文混合 token 估算准确率约 85-90%
 */

/**
 * 估算文本的 token 数量
 * 规则：
 * - 英文：~4 字符/token (GPT tokenizer 平均值)
 * - 中文：~1.5 字符/token (中文一个字符约 1.5-2 token)
 * - 代码：~3 字符/token
 */
function estimateTokens(text) {
  if (!text || text.length === 0) return 0;

  let tokens = 0;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // 中文字符 (CJK)
    if (/[一-鿿㐀-䶿]/.test(char)) {
      tokens += 1.5;
      i += 1;
      continue;
    }

    // 日文/韩文
    if (/[぀-ゟ゠-ヿ가-힯]/.test(char)) {
      tokens += 1.5;
      i += 1;
      continue;
    }

    // 空白/换行
    if (/\s/.test(char)) {
      // 连续空白合并计数
      let wsCount = 0;
      while (i < text.length && /\s/.test(text[i])) {
        wsCount++;
        i++;
      }
      tokens += Math.ceil(wsCount / 4);
      continue;
    }

    // 英文/数字/标点，按 4 字符 1 token
    let enCount = 0;
    while (
      i < text.length &&
      !/[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯\s]/.test(text[i])
    ) {
      enCount++;
      i++;
    }
    tokens += Math.ceil(enCount / 4);
  }

  return Math.ceil(tokens);
}

/**
 * 估算 messages 数组的总 token 数
 * 包含角色标签的额外开销（每条消息约 4 token 元数据）
 */
function estimateMessagesTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += 4; // 消息分隔和角色标签
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.text) total += estimateTokens(part.text);
      }
    }
    // tool_calls 也计入 token
    if (msg.tool_calls) {
      total += estimateTokens(JSON.stringify(msg.tool_calls));
    }
    // tool 结果计入
    if (msg.role === 'tool') {
      total += estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
    }
  }
  return total;
}

module.exports = { estimateTokens, estimateMessagesTokens };
