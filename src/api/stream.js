/**
 * SSE (Server-Sent Events) 流解析器
 * 解析 DeepSeek API 的流式响应
 */
const { requestWithRetry } = require('./client');

/**
 * 流式聊天补全
 * @param {Object} config
 * @param {Array} messages
 * @param {Object} opts - { onToken, onToolCall, onDone, onError, tools }
 * @returns {Promise<{content: string, toolCalls: Array}>}
 */
async function streamChat(config, messages, opts = {}) {
  const { onToken, onToolCall, onDone, onError, tools } = opts;

  const body = {
    model: config.model || 'deepseek-chat',
    messages: messages,
    max_tokens: config.maxTokens || 8192,
    stream: true,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  let response;
  try {
    response = await requestWithRetry(config, '/v1/chat/completions', body, true);
  } catch (err) {
    if (onError) onError(err);
    throw err;
  }

  return new Promise((resolve, reject) => {
    let fullContent = '';
    const toolCallsMap = new Map(); // index -> { id, name, arguments }
    let buffer = '';
    let finished = false;

    response.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');

      // 按行分割
      const lines = buffer.split('\n');
      // 保留不完整的最后一行
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith(':')) continue;

        // 检查 [DONE] 标记
        if (trimmed === 'data: [DONE]') {
          if (!finished) {
            finished = true;
            const toolCalls = Array.from(toolCallsMap.values());
            if (onDone) onDone({ content: fullContent, toolCalls });
            resolve({ content: fullContent, toolCalls });
          }
          return;
        }

        // 解析 data: 行
        if (!trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);

          // 检查是否有错误
          if (parsed.error) {
            const err = new Error(parsed.error.message || 'API 返回错误');
            if (onError) onError(err);
            reject(err);
            return;
          }

          const choice = parsed.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;
          if (!delta) continue;

          // 文本内容
          if (delta.content) {
            fullContent += delta.content;
            if (onToken) onToken(delta.content);
          }

          // 推理内容 (deepseek-reasoner)
          if (delta.reasoning_content) {
            // 将推理内容以特殊标记输出
            if (onToken) onToken(delta.reasoning_content);
          }

          // 工具调用
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsMap.has(idx)) {
                toolCallsMap.set(idx, {
                  id: tc.id || '',
                  type: 'function',
                  function: { name: tc.function?.name || '', arguments: '' },
                });
              }

              const entry = toolCallsMap.get(idx);
              if (tc.id) entry.id = tc.id;
              // name 是完整下发，直接赋值；arguments 是增量下发，需要拼接
              if (tc.function?.name) entry.function.name = tc.function.name;
              if (tc.function?.arguments) entry.function.arguments += tc.function.arguments;
            }

            if (onToolCall) {
              for (const tc of delta.tool_calls) {
                onToolCall(tc);
              }
            }
          }

          // 检查 finish_reason
          if (choice.finish_reason && !finished) {
            finished = true;
            const toolCalls = Array.from(toolCallsMap.values());
            if (onDone) onDone({ content: fullContent, toolCalls });
            resolve({ content: fullContent, toolCalls });
          }
        } catch (parseErr) {
          // JSON 解析错误 — 可能是 chunk 被截断，跳过即可
          if (process.env.DEBUG) {
            console.error(`[DEBUG] SSE parse error: ${parseErr.message} | data: ${jsonStr.slice(0, 100)}`);
          }
        }
      }
    });

    response.on('error', (err) => {
      if (finished) return; // 已经完成则忽略
      finished = true;
      if (fullContent) {
        // 已有部分内容，尽量返回
        const toolCalls = Array.from(toolCallsMap.values());
        resolve({ content: fullContent, toolCalls, truncated: true });
      } else {
        const wrappedErr = new Error(`流式连接中断: ${err.message}`);
        if (onError) onError(wrappedErr);
        reject(wrappedErr);
      }
    });

    response.on('end', () => {
      if (!finished) {
        finished = true;
        const toolCalls = Array.from(toolCallsMap.values());
        resolve({ content: fullContent, toolCalls });
      }
    });
  });
}

module.exports = { streamChat };
