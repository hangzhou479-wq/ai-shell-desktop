/**
 * 聊天补全模块
 * 整合流式和非流式请求，处理 Tool Calling 循环
 */
const { requestWithRetry } = require('./client');
const { streamChat } = require('./stream');

/**
 * 发送消息并获取回复（支持流式）
 * @param {Object} config
 * @param {Array} messages
 * @param {Object} opts - { stream, onToken, tools }
 * @returns {Promise<{content: string, toolCalls: Array}>}
 */
async function sendMessage(config, messages, opts = {}) {
  const useStream = opts.stream !== false;

  if (useStream) {
    return streamChat(config, messages, {
      onToken: opts.onToken,
      tools: opts.tools,
    });
  }

  // 非流式请求
  const body = {
    model: config.model || 'deepseek-chat',
    messages: messages,
    max_tokens: config.maxTokens || 8192,
    stream: false,
  };

  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
  }

  const response = await requestWithRetry(config, '/v1/chat/completions', body, false);

  // 读取响应体
  let data = '';
  response.on('data', chunk => data += chunk);
  await new Promise((resolve) => response.on('end', resolve));

  const parsed = JSON.parse(data);

  if (parsed.error) {
    throw new Error(parsed.error.message || 'API 返回错误');
  }

  const choice = parsed.choices?.[0];
  if (!choice) {
    throw new Error('API 返回格式异常（无 choices）');
  }

  const message = choice.message;
  return {
    content: message.content || '',
    toolCalls: message.tool_calls || [],
  };
}

/**
 * 执行完整的 Tool Calling 循环
 * 持续发送消息直到 LLM 不再请求工具调用
 *
 * @param {Object} config
 * @param {Object} history - HistoryManager 实例
 * @param {Function} dispatchTool - 工具分发函数
 * @param {Function} onToken - 流式 token 回调
 * @param {Function} onToolStart - 工具开始执行回调
 * @param {Function} onToolEnd - 工具执行完成回调
 * @param {Array} tools - 工具定义列表
 * @param {number} maxIterations - 最大工具调用轮数
 * @returns {Promise<{content: string, toolCalls: Array}>}
 */
async function runToolCallingLoop(config, history, {
  dispatchTool,
  onToken,
  onToolStart,
  onToolEnd,
  tools = [],
  maxIterations = 10,
} = {}) {
  let iteration = 0;
  let finalContent = '';
  let allToolCalls = [];

  while (iteration < maxIterations) {
    iteration++;
    const messages = history.getMessages();

    const result = await sendMessage(config, messages, {
      stream: true,
      onToken,
      tools: tools.length > 0 ? tools : undefined,
    });

    // 如果有工具调用
    if (result.toolCalls && result.toolCalls.length > 0) {
      // 保存助手消息（包含 tool_calls）
      history.addAssistantMessage(result.content || null, result.toolCalls);
      allToolCalls.push(...result.toolCalls);

      // 执行每个工具
      for (const tc of result.toolCalls) {
        const toolName = tc.function?.name || 'unknown';
        let toolArgs = {};

        try {
          toolArgs = JSON.parse(tc.function?.arguments || '{}');
        } catch (e) {
          history.addToolResult(tc.id, toolName, `参数解析错误: ${e.message}`);
          continue;
        }

        if (onToolStart) onToolStart(toolName, toolArgs);

        try {
          const toolResult = await dispatchTool(toolName, toolArgs);
          const resultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
          history.addToolResult(tc.id, toolName, resultStr);

          if (onToolEnd) onToolEnd(toolName, null);
        } catch (err) {
          history.addToolResult(tc.id, toolName, `执行出错: ${err.message}`);

          if (onToolEnd) onToolEnd(toolName, err);
        }
      }

      // 继续下一轮（让 LLM 处理工具结果）
      continue;
    }

    // 没有工具调用，最终回复
    if (result.content) {
      finalContent = result.content;
      history.addAssistantMessage(result.content);
    }

    break;
  }

  if (iteration >= maxIterations && !finalContent) {
    finalContent = '已达到最大工具调用轮数，但任务可能尚未完成。请考虑简化问题。';
  }

  return { content: finalContent, toolCalls: allToolCalls };
}

module.exports = { sendMessage, runToolCallingLoop };
