/**
 * 终端代码语法高亮
 * 纯 JS 实现，零依赖，支持常见语言
 */
const colors = require('./colors');

// 语言关键词
const KEYWORDS = {
  js: ['const','let','var','function','async','await','return','if','else','for','while',
       'class','extends','new','this','super','import','export','default','from','try','catch',
       'throw','finally','typeof','instanceof','in','of','switch','case','break','continue',
       'delete','void','yield','static','get','set','null','undefined','true','false'],
  ts: ['interface','type','enum','implements','abstract','readonly','as','is','keyof',
       'infer','never','unknown','any','string','number','boolean','symbol','bigint'],
  py: ['def','class','lambda','global','nonlocal','pass','del','with','as','elif',
       'raise','except','finally','is','not','and','or','in','None','True','False',
       'self','print','range','len','list','dict','set','tuple','int','str','float','bool'],
  sh: ['if','then','else','elif','fi','case','esac','for','while','until','do','done',
       'in','function','return','exit','export','local','source','echo','read','set','unset'],
  go: ['func','var','type','struct','interface','map','chan','go','select','defer',
       'package','import','range','fallthrough','nil','true','false'],
  rust: ['fn','let','mut','pub','crate','mod','use','impl','trait','enum','struct',
         'match','where','self','super','unsafe','async','await','move','ref','dyn'],
  sql: ['SELECT','FROM','WHERE','INSERT','UPDATE','DELETE','CREATE','DROP','ALTER',
        'TABLE','INDEX','VIEW','JOIN','LEFT','RIGHT','INNER','OUTER','ON','AND','OR',
        'NOT','NULL','IS','IN','LIKE','BETWEEN','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET',
        'COUNT','SUM','AVG','MAX','MIN','AS','DISTINCT','UNION','ALL','SET','VALUES','INTO'],
};

// 语言特定样式
const TOKEN_STYLES = {
  keyword:   colors.magenta,
  string:    colors.green,
  number:    colors.yellow,
  comment:   colors.dim,
  function:  colors.cyan,
  builtin:   colors.blue,
  operator:  colors.yellow,
  type:      colors.cyan,
  property:  colors.white,
};

/**
 * 根据语言对代码行进行语法高亮
 */
function highlightLine(line, lang) {
  const langLower = (lang || '').toLowerCase();

  // 映射语言别名
  const langMap = {
    javascript: 'js', js: 'js', jsx: 'js', mjs: 'js', cjs: 'js',
    typescript: 'ts', ts: 'ts', tsx: 'ts',
    python: 'py', py: 'py', python3: 'py',
    bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh',
    go: 'go', golang: 'go',
    rust: 'rust', rs: 'rust',
    sql: 'sql',
    json: 'json', yaml: 'yaml', toml: 'toml',
    html: 'html', css: 'css', scss: 'scss',
    markdown: 'md', md: 'md',
  };

  const langKey = langMap[langLower] || langLower;

  if (!KEYWORDS[langKey]) {
    // 不支持的语言：只做基本的字符串和注释高亮
    return basicHighlight(line);
  }

  return fullHighlight(line, langKey);
}

/**
 * 完整高亮
 */
function fullHighlight(line, langKey) {
  const keywords = KEYWORDS[langKey];
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inTemplateLiteral = false;

  while (i < line.length) {
    // 跳过已处理的字符串
    if (inString) {
      const end = line.indexOf(stringChar, i);
      if (end === -1) {
        result += TOKEN_STYLES.string(line.slice(i));
        break;
      }
      result += TOKEN_STYLES.string(line.slice(i, end + 1));
      i = end + 1;
      inString = false;
      continue;
    }

    // 注释
    if (!inComment && line[i] === '/' && line[i + 1] === '/') {
      result += TOKEN_STYLES.comment(line.slice(i));
      break;
    }
    if (!inComment && line[i] === '#') {
      result += TOKEN_STYLES.comment(line.slice(i));
      break;
    }

    // 字符串
    if (!inComment && (line[i] === '"' || line[i] === "'" || line[i] === '`')) {
      stringChar = line[i];
      if (stringChar === '`') inTemplateLiteral = true;
      inString = true;
      result += TOKEN_STYLES.string(stringChar);
      i++;
      continue;
    }

    // 数字
    if (!inComment && /\d/.test(line[i]) && (i === 0 || /[\s,(\[{<>+\-*/%=!&|^~?:;]/.test(line[i - 1]))) {
      let num = '';
      while (i < line.length && /[\d.x_abcdefABCDEF]/.test(line[i])) {
        num += line[i];
        i++;
      }
      result += TOKEN_STYLES.number(num);
      continue;
    }

    // 单词（可能是关键词）
    if (/[a-zA-Z_$]/.test(line[i])) {
      let word = '';
      let start = i;
      while (i < line.length && /[a-zA-Z0-9_$]/.test(line[i])) {
        word += line[i];
        i++;
      }

      if (keywords.includes(word)) {
        result += TOKEN_STYLES.keyword(word);
      } else if (isBuiltin(word)) {
        result += TOKEN_STYLES.builtin(word);
      } else if (line[start - 1] === '(' || (i < line.length && line[i] === '(')) {
        // 可能是函数调用
        result += TOKEN_STYLES.function(word);
      } else {
        result += word;
      }
      continue;
    }

    // 其他字符
    result += line[i];
    i++;
  }

  return result;
}

/**
 * 基础高亮（不支持的語言）
 */
function basicHighlight(line) {
  let result = '';
  let i = 0;

  while (i < line.length) {
    // 字符串
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
      const end = line.indexOf(quote, i + 1);
      if (end !== -1) {
        result += TOKEN_STYLES.string(line.slice(i, end + 1));
        i = end + 1;
      } else {
        result += line[i];
        i++;
      }
      continue;
    }

    // 注释
    if ((line[i] === '/' && line[i + 1] === '/') || line[i] === '#') {
      result += TOKEN_STYLES.comment(line.slice(i));
      break;
    }

    result += line[i];
    i++;
  }

  return result;
}

function isBuiltin(word) {
  const builtins = ['console','process','require','module','exports','__dirname','__filename',
    'Buffer','Promise','Array','Object','String','Number','Boolean','Map','Set','WeakMap',
    'WeakSet','Symbol','Error','Math','JSON','Date','RegExp','parseInt','parseFloat',
    'setTimeout','setInterval','clearTimeout','clearInterval','fs','path','os','http','https',
    'print','input','open','range','enumerate','zip','map','filter','reduce','sorted','reversed',
    'fmt','Println','Printf','Sprintf','Errorf','make','append','copy','delete','close','len','cap',
    'println','eprintln','write','read','unwrap','expect','ok','err','Some','None','Ok','Err',
    'import','export','log','error','warn','info','debug','trace'];
  return builtins.includes(word);
}

module.exports = { highlightLine };
