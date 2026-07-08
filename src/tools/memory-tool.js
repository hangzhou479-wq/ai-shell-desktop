/**
 * 长期记忆工具
 * 跨会话记住用户偏好和项目信息
 */
const { globalMemory } = require('../utils/memory');

module.exports = {
  memorySave: async function({ key, value }) {
    globalMemory.remember(key, value);
    return `已记住: "${key}" = ${value}`;
  },

  memoryRecall: async function({ key }) {
    const val = globalMemory.recall(key);
    if (val === null) return `未找到关于 "${key}" 的记忆`;
    return `记忆 [${key}]: ${val}`;
  },

  memorySearch: async function({ query }) {
    const results = globalMemory.search(query);
    if (results.length === 0) return `未找到与 "${query}" 相关的记忆`;
    let out = `搜索 "${query}" 的结果:\n`;
    results.forEach(r => out += `- ${r.key}: ${r.value}\n`);
    return out;
  },

  memoryList: async function() {
    const facts = globalMemory.listFacts();
    const prefs = globalMemory.getAllPreferences();
    let out = '';
    if (facts.length > 0) {
      out += `记忆 (${facts.length}):\n`;
      facts.forEach(f => out += `- ${f.key}: ${f.value}\n`);
    }
    if (Object.keys(prefs).length > 0) {
      out += `\n偏好:\n`;
      Object.entries(prefs).forEach(([k, v]) => out += `- ${k}: ${v}\n`);
    }
    return out || '暂无记忆';
  },

  memoryForget: async function({ key }) {
    globalMemory.forget(key);
    return `已删除记忆: "${key}"`;
  },

  setPreference: async function({ key, value }) {
    globalMemory.setPreference(key, value);
    return `已设置偏好: ${key} = ${value}`;
  },

  saveContext: async function({ summary }) {
    const cwd = process.cwd();
    globalMemory.saveProjectContext(cwd, summary);
    return `已保存项目上下文: ${cwd}`;
  },

  loadContext: async function() {
    const cwd = process.cwd();
    const ctx = globalMemory.loadProjectContext(cwd);
    return ctx ? `项目上下文:\n${ctx}` : '暂无该项目上下文';
  },
};
