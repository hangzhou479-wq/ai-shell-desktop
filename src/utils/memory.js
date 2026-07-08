/**
 * 长期记忆系统
 * 跨会话记住项目状态、用户偏好、重要信息
 */
const fs = require('fs');
const path = require('path');
const platform = require('./platform');

const MEMORY_FILE = 'memory.json';

class LongTermMemory {
  constructor() {
    this.data = { facts: {}, preferences: {}, projectContext: {} };
    this.filePath = path.join(platform.getConfigDir(), MEMORY_FILE);
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch (e) { /* 忽略损坏文件 */ }
  }

  _save() {
    platform.ensureDir(platform.getConfigDir());
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // 记住一个事实
  remember(key, value) {
    this.data.facts[key] = {
      value,
      at: new Date().toISOString(),
    };
    this._save();
  }

  // 回忆一个事实
  recall(key) {
    return this.data.facts[key]?.value || null;
  }

  // 搜索相关记忆
  search(query) {
    const q = query.toLowerCase();
    const results = [];
    for (const [k, v] of Object.entries(this.data.facts)) {
      if (k.toLowerCase().includes(q) || String(v.value).toLowerCase().includes(q)) {
        results.push({ key: k, value: v.value, at: v.at });
      }
    }
    return results;
  }

  // 设置偏好
  setPreference(key, value) {
    this.data.preferences[key] = value;
    this._save();
  }

  // 获取偏好
  getPreference(key) {
    return this.data.preferences[key] || null;
  }

  // 获取所有偏好
  getAllPreferences() {
    return { ...this.data.preferences };
  }

  // 保存项目上下文
  saveProjectContext(projectDir, context) {
    const key = projectDir.replace(/\//g, '_');
    this.data.projectContext[key] = {
      path: projectDir,
      context,
      updatedAt: new Date().toISOString(),
    };
    this._save();
  }

  // 加载项目上下文
  loadProjectContext(projectDir) {
    const key = projectDir.replace(/\//g, '_');
    return this.data.projectContext[key]?.context || null;
  }

  // 列出所有记忆
  listFacts() {
    return Object.entries(this.data.facts).map(([k, v]) => ({
      key: k, value: v.value, at: v.at,
    }));
  }

  // 删除记忆
  forget(key) {
    delete this.data.facts[key];
    this._save();
  }

  // 清空所有记忆
  clear() {
    this.data = { facts: {}, preferences: {}, projectContext: {} };
    this._save();
  }
}

// 全局单例
const globalMemory = new LongTermMemory();

module.exports = { LongTermMemory, globalMemory };
