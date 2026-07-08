/**
 * 配置加载器
 * 优先级：环境变量 > 配置文件 > 默认值
 */
const fs = require('fs');
const path = require('path');
const platform = require('../utils/platform');
const defaults = require('./defaults');

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function load() {
  // 从默认值开始
  let config = { ...defaults };

  // 从配置文件加载
  const configPath = platform.getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = deepMerge(config, fileConfig);
    } catch (err) {
      // 配置文件损坏，使用默认值，但会打印警告
      console.warn(`警告: 配置文件读取失败 (${configPath})，使用默认设置`);
    }
  }

  // 环境变量覆盖（最高优先级）
  if (process.env.DEEPSEEK_API_KEY) {
    config.apiKey = process.env.DEEPSEEK_API_KEY;
  }
  if (process.env.DEEPSEEK_API_BASE) {
    config.apiBaseUrl = process.env.DEEPSEEK_API_BASE;
  }
  if (process.env.DEEPSEEK_MODEL) {
    config.model = process.env.DEEPSEEK_MODEL;
  }
  if (process.env.AI_SHELL_PROXY) {
    config.proxy = process.env.AI_SHELL_PROXY;
  }
  if (process.env.AI_SHELL_TIMEOUT) {
    config.timeout = parseInt(process.env.AI_SHELL_TIMEOUT, 10);
  }
  if (process.env.AI_SHELL_NO_CONFIRM === '1') {
    config.requireConfirmation = false;
  }

  return config;
}

/**
 * 保存配置到文件
 */
function save(config) {
  const configDir = platform.getConfigDir();
  platform.ensureDir(configDir);

  const configPath = platform.getConfigPath();
  const toSave = { ...config };
  // 不保存 API Key 到配置文件（安全考虑，建议用户用环境变量）
  delete toSave.apiKey;

  fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf-8');
}

module.exports = { load, save, deepMerge };
