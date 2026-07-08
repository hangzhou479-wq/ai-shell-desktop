/**
 * Markdown → 终端 ANSI 渲染器
 * 使用 marked 解析 + 自定义渲染
 */
const { marked } = require('marked');
const colors = require('./colors');
const { highlightLine } = require('./highlight');

// 配置 marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * 将 Markdown 文本渲染为带 ANSI 颜色的终端输出
 */
function renderMarkdown(text) {
  if (!text) return '';

  // 解析 token
  const tokens = marked.lexer(text);
  return renderTokens(tokens);
}

function renderTokens(tokens) {
  let output = '';

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        output += '\n' + renderHeading(token) + '\n';
        break;
      case 'paragraph':
        output += renderInline(token.tokens || token.text) + '\n';
        break;
      case 'code':
        output += renderCodeBlock(token) + '\n';
        break;
      case 'list':
        output += renderList(token) + '\n';
        break;
      case 'blockquote':
        output += renderBlockquote(token) + '\n';
        break;
      case 'hr':
        output += colors.dim('─'.repeat(process.stdout.columns || 80)) + '\n';
        break;
      case 'space':
        output += '\n';
        break;
      default:
        // 对于其他类型（如表格），用原始文本
        if (token.raw) output += token.raw;
        break;
    }
  }

  return output.trim();
}

function renderHeading(token) {
  const text = renderInline(token.tokens);
  const level = token.depth;

  if (level === 1) return colors.bold('\n' + '═'.repeat(60)) + '\n' + colors.bold(colors.cyan(text)) + '\n' + colors.bold('═'.repeat(60));
  if (level === 2) return colors.bold(colors.cyan('── ' + text + ' ──'));
  if (level === 3) return colors.bold(colors.yellow('▶ ' + text));
  return colors.bold(text);
}

function renderInline(tokens) {
  if (!tokens) return '';
  if (typeof tokens === 'string') return tokens;

  if (Array.isArray(tokens)) {
    return tokens.map(t => renderInlineToken(t)).join('');
  }

  return renderInlineToken(tokens);
}

function renderInlineToken(token) {
  if (typeof token === 'string') return token;

  switch (token.type) {
    case 'text':
    case 'raw':
      return token.text || token.raw || '';
    case 'strong':
      return colors.bold(renderInline(token.tokens));
    case 'em':
      return colors.italic(renderInline(token.tokens));
    case 'codespan':
      return colors.yellow(token.text);
    case 'link':
      return `${renderInline(token.tokens)} ${colors.dim(`(${token.href})`)}`;
    case 'image':
      return colors.dim(`[图片: ${token.title || token.href}]`);
    case 'del':
      return colors.dim(renderInline(token.tokens));
    case 'br':
      return '\n';
    default:
      return token.text || token.raw || '';
  }
}

function renderCodeBlock(token) {
  const lang = token.lang || '';
  const code = token.text;
  const lines = code.split('\n');

  let output = '\n' + colors.dim('┌' + '─'.repeat(60)) + '\n';

  // 语言标签
  if (lang) {
    output += colors.dim('│ ') + colors.bold(colors.cyan(lang)) + '\n';
    output += colors.dim('├' + '─'.repeat(60)) + '\n';
  }

  // 代码行
  const maxLines = Math.min(lines.length, 30); // 最多显示 30 行
  for (let i = 0; i < maxLines; i++) {
    const lineNum = String(i + 1).padStart(3, ' ');
    const highlighted = highlightLine(lines[i], lang);
    output += colors.dim(`│ ${colors.gray(lineNum)} `) + highlighted + '\n';
  }

  if (lines.length > maxLines) {
    output += colors.dim(`│ ... 还有 ${lines.length - maxLines} 行\n`);
  }

  output += colors.dim('└' + '─'.repeat(60));

  return output;
}

function renderList(token) {
  let output = '';
  const items = token.items || [];
  const ordered = token.ordered;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const bullet = ordered ? `${colors.bold(String(i + 1))}.` : colors.bold('•');
    const text = renderInline(item.tokens || item.text);

    // 处理多行文本
    const lines = text.split('\n');
    output += `  ${bullet} ${lines[0]}\n`;
    for (let j = 1; j < lines.length; j++) {
      output += `    ${lines[j]}\n`;
    }
  }

  return output;
}

function renderBlockquote(token) {
  const text = renderInline(token.tokens || token.text);
  const lines = text.split('\n');
  return lines.map(l => colors.dim(colors.italic(`│ ${l}`))).join('\n');
}

module.exports = { renderMarkdown };
