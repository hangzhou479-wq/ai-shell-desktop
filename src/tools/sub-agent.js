/**
 * 子 Agent 系统
 * 主 Agent 可以派生子 Agent 并行处理多个任务
 */
const { sendMessage } = require('../api/chat');

// 子 Agent 的独立 system prompt
const SUBAGENT_PROMPT = `你是一个专注于单一任务的 AI 助手。你的任务由主 Agent 分配。
- 只做分配给你的这件事，不要做多余的
- 用最简洁的方式回复，不要寒暄
- 如果需要读文件或执行命令，直接使用工具
- 完成后给出明确的结论`;

module.exports = async function subAgent({ tasks, max_workers = 3 }, context) {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return '错误: 需要提供 tasks 数组，每项包含 task（描述）和可选的 context（背景）';
  }

  const config = context?.config;
  if (!config?.apiKey) return '错误: 未配置 API Key';

  const results = [];

  // 并行执行，限制并发数
  async function runBatch(batch) {
    const batchResults = await Promise.allSettled(
      batch.map(async (task, i) => {
        const desc = typeof task === 'string' ? task : task.task;
        const ctx = typeof task === 'string' ? '' : (task.context || '');

        const messages = [
          { role: 'system', content: SUBAGENT_PROMPT },
          { role: 'user', content: ctx ? `背景:\n${ctx}\n\n任务:\n${desc}` : desc },
        ];

        try {
          const result = await sendMessage(config, messages, { stream: false });
          return { index: i, task: desc.slice(0, 60), result: result.content };
        } catch (err) {
          return { index: i, task: desc.slice(0, 60), error: err.message };
        }
      })
    );
    return batchResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
  }

  // 分批执行
  for (let i = 0; i < tasks.length; i += max_workers) {
    const batch = tasks.slice(i, i + max_workers);
    const batchResults = await runBatch(batch);
    results.push(...batchResults);
  }

  // 汇总结果
  const succeeded = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;

  let output = `子 Agent 执行完成: ${succeeded}/${tasks.length} 成功`;
  if (failed > 0) output += `, ${failed} 失败`;
  output += '\n\n';

  results.forEach((r, i) => {
    if (r.error) {
      output += `**Agent ${i + 1}:** ❌ ${r.error}\n\n`;
    } else {
      const summary = r.result.length > 300 ? r.result.slice(0, 300) + '...' : r.result;
      output += `**Agent ${i + 1}:** ${r.task}\n${summary}\n\n`;
    }
  });

  return output;
};
