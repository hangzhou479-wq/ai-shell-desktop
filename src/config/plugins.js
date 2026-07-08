/**
 * 插件系统 — 自定义 Slash 命令
 * 用户可在 ~/.ai-shell/plugins.json 中定义自己的命令
 *
 * 配置示例:
 * {
 *   "commands": [
 *     { "name": "/review", "prompt": "请对以下代码进行Code Review，重点关注性能和安全性：" },
 *     { "name": "/fix",    "prompt": "请修复以下代码中的bug：" },
 *     { "name": "/test",   "prompt": "请为以下代码编写单元测试：" }
 *   ]
 * }
 */
const fs = require('fs');
const path = require('path');
const platform = require('../utils/platform');
const colors = require('../terminal/colors');

const DEFAULT_PLUGINS = {
  commands: [
    {
      name: '/review',
      description: 'Code Review — 审查代码质量和安全问题',
      prompt: '请对以下代码进行全面的Code Review，从以下维度分析：\n1. 功能正确性（逻辑错误、边界情况）\n2. 性能问题（不必要的计算、内存泄漏）\n3. 安全问题（注入风险、权限问题）\n4. 代码风格和可维护性\n请给出具体的修改建议，并标注严重程度（🔴严重 🟡建议 🟢优化）：',
    },
    {
      name: '/fix',
      description: '修复 Bug — 分析并修复代码中的问题',
      prompt: '请分析以下代码中存在的问题并修复：\n1. 找出所有潜在的bug\n2. 对每个bug给出修复方案\n3. 使用 replace_in_file 工具应用修复\n\n如果代码看起来没有问题，请诚实地说出来，不要编造问题：',
    },
    {
      name: '/test',
      description: '生成测试 — 为代码编写单元测试',
      prompt: '请为以下代码编写全面的单元测试，要求：\n1. 覆盖主要功能路径\n2. 覆盖边界情况和错误处理\n3. 使用合适的测试框架\n4. 每个测试用中文注释说明目的\n\n测试代码应该可以直接运行：',
    },
    {
      name: '/explain',
      description: '解释代码 — 逐行解释代码逻辑',
      prompt: '请详细解释以下代码，要求：\n1. 先概述整体功能和用途\n2. 逐段或逐行解释关键逻辑\n3. 指出值得注意的设计模式或技巧\n4. 如果注意到潜在问题，也一并指出：',
    },
    {
      name: '/optimize',
      description: '优化性能 — 分析和优化代码性能',
      prompt: '请分析以下代码的性能瓶颈并给出优化方案：\n1. 时间复杂度分析\n2. 空间复杂度分析\n3. 具体的优化建议\n4. 如果有更优的算法或数据结构，请说明\n\n如果代码已经足够优化，请说明原因：',
    },
    {
      name: '/refactor',
      description: '重构代码 — 改善结构而不改变行为',
      prompt: '请对以下代码进行重构，要求：\n1. 保持原有功能不变\n2. 提高代码可读性和可维护性\n3. 消除重复代码\n4. 合理拆分函数/类\n5. 使用 replace_in_file 工具应用重构：',
    },
  ],
};

/**
 * 加载插件配置
 */
function loadPlugins() {
  const configPath = path.join(platform.getConfigDir(), 'plugins.json');

  // 首次使用：创建默认配置
  if (!fs.existsSync(configPath)) {
    platform.ensureDir(platform.getConfigDir());
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_PLUGINS, null, 2), 'utf-8');
    return { commands: [...DEFAULT_PLUGINS.commands] };
  }

  try {
    const userPlugins = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // 合并用户命令和默认命令（用户同名命令覆盖默认）
    const merged = new Map();
    for (const cmd of DEFAULT_PLUGINS.commands) {
      merged.set(cmd.name, cmd);
    }
    for (const cmd of (userPlugins.commands || [])) {
      merged.set(cmd.name, cmd);
    }

    return { commands: [...merged.values()] };
  } catch (err) {
    console.log(colors.warn(`插件配置解析失败: ${err.message}，使用默认配置`));
    return { commands: [...DEFAULT_PLUGINS.commands] };
  }
}

/**
 * 查找插件命令
 */
function findPluginCommand(name) {
  const plugins = loadPlugins();
  return plugins.commands.find(c => c.name === name);
}

/**
 * 获取所有插件命令
 */
function getAllCommands() {
  const plugins = loadPlugins();
  return plugins.commands;
}

/**
 * 重置为默认插件配置
 */
function resetPlugins() {
  const configPath = path.join(platform.getConfigDir(), 'plugins.json');
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_PLUGINS, null, 2), 'utf-8');
  return DEFAULT_PLUGINS.commands;
}

module.exports = { loadPlugins, findPluginCommand, getAllCommands, resetPlugins, DEFAULT_PLUGINS };
