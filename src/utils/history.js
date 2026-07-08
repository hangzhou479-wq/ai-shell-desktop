/**
 * 对话历史管理
 * - 内存中维护对话上下文
 * - 支持持久化到磁盘
 * - 自动裁剪超出 token 上限的历史
 */
const fs = require('fs');
const path = require('path');
const platform = require('./platform');
const { estimateMessagesTokens } = require('./token');
const constants = require('../constants');

class HistoryManager {
  constructor(sessionName = 'default') {
    this.sessionName = sessionName;
    this.messages = [];
    this.metadata = {
      createdAt: new Date().toISOString(),
      model: constants.DEFAULT_MODEL,
    };
  }

  /**
   * 添加系统消息
   */
  setSystemPrompt(prompt) {
    // 如果已有系统消息，替换它
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0] = { role: 'system', content: prompt };
    } else {
      this.messages.unshift({ role: 'system', content: prompt });
    }
  }

  /**
   * 添加用户消息
   */
  addUserMessage(content) {
    this.messages.push({ role: 'user', content });
  }

  /**
   * 添加助手消息（可能包含 tool_calls）
   */
  addAssistantMessage(content, toolCalls) {
    const msg = { role: 'assistant' };
    if (content) msg.content = content;
    if (toolCalls) msg.tool_calls = toolCalls;
    this.messages.push(msg);
  }

  /**
   * 添加工具调用结果
   */
  addToolResult(toolCallId, toolName, content) {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      name: toolName,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    });
  }

  /**
   * 裁剪超出 token 上限的历史
   * 按"对话轮次"移除，保持 tool 消息不孤儿
   */
  trim(maxTokens) {
    const systemMsg = this.messages.find(m => m.role === 'system');
    const otherMsgs = this.messages.filter(m => m.role !== 'system');

    // 将消息分成轮次（每轮以 user 开始，到下一个 user 之前或结尾）
    const turns = [];
    let currentTurn = [];
    for (const msg of otherMsgs) {
      if (msg.role === 'user' && currentTurn.length > 0) {
        turns.push(currentTurn);
        currentTurn = [];
      }
      currentTurn.push(msg);
    }
    if (currentTurn.length > 0) turns.push(currentTurn);

    // 从最早的轮次开始移除，直到 token 不超限
    while (turns.length > 1) {
      const flat = systemMsg ? [systemMsg, ...turns.flat()] : turns.flat();
      if (estimateMessagesTokens(flat) <= maxTokens) break;
      turns.shift();
    }

    const flatMsgs = turns.flat();
    this.messages = systemMsg ? [systemMsg, ...flatMsgs] : flatMsgs;

    if (flatMsgs.length < otherMsgs.length) {
      console.log(`\x1b[90m[上下文已裁剪，保留最近 ${turns.length} 轮对话]\x1b[0m`);
    }
  }

  /**
   * 获取所有消息（用于 API 调用）
   */
  getMessages() {
    return this.messages;
  }

  /**
   * 清空历史（保留 system prompt）
   */
  clear() {
    const systemMsg = this.messages.find(m => m.role === 'system');
    this.messages = systemMsg ? [systemMsg] : [];
  }

  /**
   * 持久化历史到磁盘
   */
  save() {
    const sessionsDir = platform.getSessionsDir();
    platform.ensureDir(sessionsDir);

    const filePath = path.join(sessionsDir, `${this.sessionName}.json`);
    const data = {
      metadata: this.metadata,
      messages: this.messages,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 从磁盘加载历史
   */
  load() {
    const filePath = path.join(platform.getSessionsDir(), `${this.sessionName}.json`);
    if (!fs.existsSync(filePath)) return false;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.messages = data.messages || [];
      this.metadata = data.metadata || {};
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 列出所有已保存的会话
   */
  static listSessions() {
    const sessionsDir = platform.getSessionsDir();
    if (!fs.existsSync(sessionsDir)) return [];

    return fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(sessionsDir, f);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          return {
            name: f.replace('.json', ''),
            createdAt: data.metadata?.createdAt,
            messages: data.messages?.length || 0,
          };
        } catch (err) {
          return { name: f.replace('.json', ''), error: true };
        }
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

module.exports = HistoryManager;
