/**
 * 工具注册中心
 * 管理所有内置工具和 MCP 工具的 Schema 定义和处理器
 */
const fs = require('fs');

// 导入所有内置工具
const readFile = require('./read-file');
const writeFile = require('./write-file');
const executeCommand = require('./execute-command');
const searchFile = require('./search-file');
const searchContent = require('./search-content');
const listDirectory = require('./list-directory');
const fileInfo = require('./file-info');
const replaceInFile = require('./replace-in-file');
const gitTools = require('./git-tools');
const createPPTX = require('./create-pptx');
const webSearch = require('./web-search');
const imageAnalyze = require('./image-analyze');
const subAgent = require('./sub-agent');
const memoryTool = require('./memory-tool');
const dbTool = require('./db-tool');
const vizTool = require('./viz-tool');
const codeTools = require('./code-tools');
const projectTool = require('./project-tool');
const pluginTools = require('./plugin-tools');
const extendTools = require('./extend-tools');

/**
 * 内置工具列表
 * 每个工具包含：
 * - definition: OpenAI/DeepSeek function calling schema
 * - handler: 执行函数 (args, context) => result
 * - requireConfirm: 是否需要用户确认
 */
const BUILTIN_TOOLS = [
  {
    definition: {
      type: 'function',
      function: {
        name: 'read_file',
        description: '读取指定路径的文件内容。可以指定起始行和读取行数来读取文件的部分内容。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '文件绝对路径或相对于当前工作目录的路径',
            },
            start_line: {
              type: 'integer',
              description: '起始行号（从1开始）。不指定则从第一行开始',
            },
            line_count: {
              type: 'integer',
              description: '读取行数。不指定则读取全部内容',
            },
          },
          required: ['path'],
        },
      },
    },
    handler: readFile,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'write_file',
        description: '创建新文件或覆写已有文件的内容。如果文件已存在，会要求确认。会自动创建不存在的父目录。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '文件绝对路径或相对于当前工作目录的路径',
            },
            content: {
              type: 'string',
              description: '要写入的文件内容',
            },
          },
          required: ['path', 'content'],
        },
      },
    },
    handler: writeFile,
    requireConfirm: true,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'execute_command',
        description: '在工作目录下执行一个 shell 命令，并返回输出结果。此操作需要用户确认后才能执行。危险命令（如 rm -rf /）会被自动拦截。',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '要在终端中执行的命令。命令会在当前工作目录下执行。',
            },
            working_dir: {
              type: 'string',
              description: '可选的执行目录。不指定则使用当前工作目录',
            },
          },
          required: ['command'],
        },
      },
    },
    handler: executeCommand,
    requireConfirm: true,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'search_file',
        description: '按文件名模式搜索文件。支持 glob 通配符模式（如 *.js, **/*.ts, src/**/*.{js,ts}）。',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'glob 搜索模式，如 *.js 或 src/**/*.ts',
            },
            directory: {
              type: 'string',
              description: '搜索的起始目录。默认为当前工作目录',
            },
            max_results: {
              type: 'integer',
              description: '最大返回文件数。默认 50',
            },
          },
          required: ['pattern'],
        },
      },
    },
    handler: searchFile,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'search_content',
        description: '在文件内容中搜索匹配的文本或正则表达式（类似 grep）。适用于搜索代码中的函数名、变量、字符串等。',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: '搜索的文本或正则表达式',
            },
            directory: {
              type: 'string',
              description: '搜索目录。默认当前工作目录',
            },
            file_pattern: {
              type: 'string',
              description: '限制搜索的文件类型，如 *.js 或 *.{ts,js}',
            },
            case_sensitive: {
              type: 'boolean',
              description: '是否区分大小写。默认 false',
            },
            max_results: {
              type: 'integer',
              description: '最大返回结果数。默认 20',
            },
          },
          required: ['pattern'],
        },
      },
    },
    handler: searchContent,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'list_directory',
        description: '列出指定目录下的文件和子目录。可以递归列出子目录内容。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '要列出的目录路径。默认为当前工作目录',
            },
            recursive: {
              type: 'boolean',
              description: '是否递归列出子目录内容。默认 false',
            },
            max_depth: {
              type: 'integer',
              description: '递归最大深度。仅在 recursive=true 时有效。默认 2',
            },
            max_results: {
              type: 'integer',
              description: '最大返回条目数。默认 100',
            },
          },
          required: [],
        },
      },
    },
    handler: listDirectory,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'file_info',
        description: '获取文件或目录的元信息，包括大小、修改时间、类型、行数（文本文件）等。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '文件或目录的路径',
            },
          },
          required: ['path'],
        },
      },
    },
    handler: fileInfo,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'replace_in_file',
        description: '精准替换文件中的指定内容。找到 old_string 并用 new_string 替换。要求 old_string 在文件中唯一出现。修改前会自动备份原文件。',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件绝对路径或相对路径' },
            old_string: { type: 'string', description: '要被替换的原始文本内容，必须和文件中完全一致（包括缩进和空格）' },
            new_string: { type: 'string', description: '替换后的新文本内容' },
          },
          required: ['path', 'old_string', 'new_string'],
        },
      },
    },
    handler: replaceInFile,
    requireConfirm: true,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'git_status',
        description: '查看 Git 仓库的当前状态，包括已修改、已暂存、未跟踪的文件，以及当前分支信息。',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: gitTools.gitStatus,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'git_diff',
        description: '查看 Git 工作区或暂存区的详细变更内容（diff）。',
        parameters: {
          type: 'object',
          properties: {
            staged: { type: 'boolean', description: '是否查看暂存区的 diff。默认 false（查看工作区变更）' },
          },
          required: [],
        },
      },
    },
    handler: gitTools.gitDiff,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'git_log',
        description: '查看 Git 提交历史记录。',
        parameters: {
          type: 'object',
          properties: {
            count: { type: 'integer', description: '显示的提交数量。默认 10' },
            file: { type: 'string', description: '可选的，只显示指定文件的提交历史' },
          },
          required: [],
        },
      },
    },
    handler: gitTools.gitLog,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'git_commit',
        description: '创建一个新的 Git 提交。会自动 add 指定的文件（或所有变更），然后 commit。此操作需要用户确认。',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: '提交信息' },
            files: { type: 'string', description: '要提交的文件路径。默认 "."（所有变更）' },
          },
          required: ['message'],
        },
      },
    },
    handler: gitTools.gitCommit,
    requireConfirm: true,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'create_pptx',
        description: '创建 PowerPoint 演示文稿 (.pptx 文件)。支持封面标题 + 多页内容。slides 参数为数组，每项包含 title 和 content。',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '输出文件路径，如 output.pptx 或 ~/Desktop/演示文稿.pptx' },
            title: { type: 'string', description: 'PPT 封面标题' },
            slides: {
              type: 'array',
              description: '幻灯片内容数组',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: '本页标题' },
                  content: { type: 'string', description: '本页正文，每行一个要点，支持 - 开头作为项目符号' },
                },
              },
            },
          },
          required: ['path'],
        },
      },
    },
    handler: createPPTX,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'web_search',
        description: '联网搜索。使用 DuckDuckGo 搜索互联网获取实时信息。适合查询最新资讯、技术文档、新闻等。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
            max_results: { type: 'integer', description: '最大结果数，默认 8' },
          },
          required: ['query'],
        },
      },
    },
    handler: webSearch.webSearch,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'web_fetch',
        description: '抓取网页内容。获取指定 URL 的文本内容，自动去除 HTML 标签和脚本。适合获取文章、文档等。',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '要抓取的网页 URL' },
            max_length: { type: 'integer', description: '最大返回字符数，默认 5000' },
          },
          required: ['url'],
        },
      },
    },
    handler: webSearch.webFetch,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'image_analyze',
        description: '分析图片内容。支持 PNG/JPG/GIF/WebP/BMP 格式。需配置视觉 API（通义千问 VL 免费）。首次使用时会提示配置方法。',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '图片文件路径' },
            question: { type: 'string', description: '可选，对图片提出的问题。不填则自动全面描述图片内容' },
          },
          required: ['path'],
        },
      },
    },
    handler: imageAnalyze,
    requireConfirm: false,
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'sub_agent',
        description: '并行派生子 Agent 处理多个独立任务。每个子 Agent 有独立的思考上下文，互不干扰。适合同时分析多个文件、并行搜索、批量审查等场景。',
        parameters: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              description: '任务列表，每项可以是字符串（任务描述）或 {task, context} 对象',
              items: {
                type: 'object',
                properties: {
                  task: { type: 'string', description: '任务描述' },
                  context: { type: 'string', description: '可选的背景信息' },
                },
              },
            },
            max_workers: { type: 'integer', description: '最大并行数，默认 3' },
          },
          required: ['tasks'],
        },
      },
    },
    handler: subAgent,
    requireConfirm: false,
  },
  makeMem('memory_save', '记住信息以便跨会话使用', { key: s('记忆名称'), value: s('记忆内容') }, ['key', 'value'], memoryTool.memorySave),
  makeMem('memory_recall', '回忆之前记住的信息', { key: s('记忆名称') }, ['key'], memoryTool.memoryRecall),
  makeMem('memory_list', '列出所有已记住的信息和偏好', {}, [], memoryTool.memoryList),
  makeMem('save_context', '保存当前项目上下文信息', { summary: s('项目上下文摘要') }, ['summary'], memoryTool.saveContext),
  makeMem('load_context', '加载当前项目上下文信息', {}, [], memoryTool.loadContext),
  makeT('db_query', '执行 SQL 查询。支持 SQLite 数据库文件', { db_path: s('数据库文件路径'), sql: s('SQL 语句') }, ['db_path', 'sql'], dbTool.dbQuery),
  makeT('db_tables', '列出 SQLite 数据库中所有表', { db_path: s('数据库文件路径') }, ['db_path'], dbTool.dbTables),
  makeT('db_schema', '查看 SQLite 数据库表结构', { db_path: s('数据库文件路径'), table: s('表名') }, ['db_path', 'table'], dbTool.dbSchema),
  makeT('generate_diagram', '生成 Mermaid 图表（流程图/时序图/类图等）', { type: { type: 'string', description: '类型: flowchart/sequence/class/er/state', enum: ['flowchart', 'sequence', 'class', 'er', 'state'] }, description: s('图表内容描述'), output_path: s('输出路径（可选）') }, ['type', 'description'], vizTool.generateDiagram),
  makeT('code_review', '获取 Git diff 进行代码审查', { directory: s('项目目录（可选）') }, [], codeTools.codeReview),
  makeT('code_run', '运行代码文件并捕获输出/错误（JS/Python/Go等）', { file: s('代码文件路径'), command: s('自定义运行命令（可选）') }, ['file'], codeTools.codeRun),
  makeT('code_lint', '对代码进行 ESLint 静态分析', { file: s('文件路径'), directory: s('项目目录（可选）') }, [], codeTools.codeLint),
  makeT('project_init', '创建项目脚手架（node-basic/react-vite/python-basic）', { template: s('模板名'), name: s('项目名'), directory: s('父目录（可选）') }, ['name'], projectTool.projectInit),
  makeT('project_install', '自动安装项目依赖（npm/pip）', { directory: s('项目目录（可选）') }, [], projectTool.projectInstall),
  makeT('project_tree', '显示项目目录树结构', { directory: s('目录（可选）'), max_depth: { type: 'integer', description: '最大深度，默认 3' } }, [], projectTool.projectTree),
  makeT('transcribe_audio', '音频转文字（需 Groq 免费 API）', { file_path: s('音频文件路径'), language: s('语言代码，默认 zh') }, ['file_path'], pluginTools.transcribeAudio),
  makeT('ide_config', '生成 IDE 配置（VS Code launch/tasks/settings/extensions）', { type: { type: 'string', enum: ['debug-node', 'tasks', 'settings', 'extensions'], description: '配置类型' }, directory: s('项目目录（可选）') }, ['type'], pluginTools.ideConfig),
  makeT('debug_analyze', '分析错误日志和堆栈信息，定位问题', { error_output: s('错误输出文本'), file: s('日志文件路径（可选）') }, [], pluginTools.debugAnalyze),
  makeT('deploy_script', '生成部署配置文件（Docker/Vercel/PM2）', { target: { type: 'string', enum: ['docker', 'docker-compose', 'vercel', 'pm2'], description: '部署目标' }, directory: s('项目目录（可选）') }, ['target'], pluginTools.deployScript),
  makeT('file_share', '启动 HTTP 文件分享服务，生成局域网下载链接', { file_path: s('要分享的文件路径'), port: { type: 'integer', description: '端口，默认 8888' } }, ['file_path'], extendTools.fileShare),
  makeT('generate_image', 'AI 文生图（免费，使用 Pollinations.ai）', { prompt: s('图片描述（英文效果更好）'), output_path: s('保存路径'), width: { type: 'integer', description: '宽度' }, height: { type: 'integer', description: '高度' } }, ['prompt'], extendTools.generateImage),
  makeT('video_process', '视频处理（压缩/裁切/转GIF/提取音频），需 FFmpeg', { file_path: s('视频文件路径'), action: { type: 'string', enum: ['compress', 'resize', 'extract-audio', 'gif', 'trim', 'concat'], description: '操作类型' }, options: s('额外参数（可选）') }, ['file_path', 'action'], extendTools.videoProcess),
  makeT('audio_process', '音频处理（格式转换/变速/裁剪/调音量），需 FFmpeg', { file_path: s('音频文件路径'), action: { type: 'string', enum: ['to-mp3', 'to-wav', 'speed', 'trim', 'volume', 'merge'], description: '操作类型' }, options: s('参数（可选）') }, ['file_path', 'action'], extendTools.audioProcess),
];

// 工具构建辅助函数
function s(desc) { return { type: 'string', description: desc }; }
function makeT(name, desc, props, req, handler) {
  return { definition: { type: 'function', function: { name, description: desc, parameters: { type: 'object', properties: props, required: req || [] } } }, handler, requireConfirm: false };
}
function makeMem(name, desc, props, req, handler) {
  return makeT(name, '长期记忆: ' + desc, props, req, handler);
}

/**
 * 注册额外的 MCP 工具
 */
class ToolRegistry {
  constructor() {
    this.tools = [...BUILTIN_TOOLS];
    this.mcpTools = [];
  }

  /**
   * 注册 MCP 工具
   */
  registerMCPTool(tool, handler) {
    this.mcpTools.push({
      definition: {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.inputSchema || { type: 'object', properties: {} },
        },
      },
      handler: async (args) => {
        // 通过 MCP client 调用
        return handler(tool.name, args);
      },
      requireConfirm: false,
      source: 'mcp',
    });
    this.tools.push(this.mcpTools[this.mcpTools.length - 1]);
  }

  /**
   * 移除所有 MCP 工具
   */
  clearMCPTools() {
    this.tools = this.tools.filter(t => t.source !== 'mcp');
    this.mcpTools = [];
  }

  /**
   * 获取所有工具定义（用于 API 请求）
   */
  getToolDefinitions() {
    return this.tools.map(t => t.definition);
  }

  /**
   * 根据类型获取工具定义（'builtin' | 'mcp' | 'all'）
   */
  getByType(type = 'all') {
    if (type === 'builtin') return this.tools.filter(t => t.source !== 'mcp');
    if (type === 'mcp') return this.tools.filter(t => t.source === 'mcp');
    return this.tools;
  }

  /**
   * 查找工具的处理器
   */
  findHandler(toolName) {
    const tool = this.tools.find(t => t.definition.function.name === toolName);
    return tool?.handler || null;
  }

  /**
   * 判断工具是否需要确认
   */
  requiresConfirm(toolName) {
    const tool = this.tools.find(t => t.definition.function.name === toolName);
    return tool?.requireConfirm || false;
  }

  /**
   * 获取工具数量
   */
  count(type = 'all') {
    return this.getByType(type).length;
  }

  /**
   * 列出所有工具名称
   */
  listNames() {
    return this.tools.map(t => ({
      name: t.definition.function.name,
      description: t.definition.function.description,
      source: t.source || 'builtin',
      requireConfirm: t.requireConfirm || false,
    }));
  }
}

module.exports = { ToolRegistry, BUILTIN_TOOLS };
