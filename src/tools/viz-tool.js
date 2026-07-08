/**
 * 代码可视化工具
 * 生成 Mermaid 图表、流程图、架构图等
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  // 生成 Mermaid 图表
  generateDiagram: async function({ type, description, output_path }) {
    const validTypes = ['flowchart', 'sequence', 'class', 'er', 'gantt', 'pie', 'state', 'mindmap'];
    if (!validTypes.includes(type)) {
      return `不支持的图表类型: ${type}\n支持: ${validTypes.join(', ')}`;
    }

    const mermaid = convertToMermaid(type, description);
    const absPath = path.resolve(output_path || `diagram-${type}.mmd`);

    // 确保目录存在
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(absPath, mermaid, 'utf-8');

    // 同时生成 HTML 预览
    const htmlPath = absPath.replace(/\.\w+$/, '.html');
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${type} Diagram</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>mermaid.initialize({startOnLoad:true,theme:'default'});</script>
</head><body style="background:#fff">
<div class="mermaid">
${mermaid}
</div>
</body></html>`;
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

    return `已生成 ${type} 图表:
- Mermaid 源文件: ${absPath}
- HTML 预览: ${htmlPath}
- 用浏览器打开 HTML 文件即可查看图表

Mermaid 代码:
\`\`\`mermaid
${mermaid}
\`\`\``;
  },
};

function convertToMermaid(type, description) {
  const d = description.toLowerCase();

  switch (type) {
    case 'flowchart':
      return `graph TD
  A[开始] --> B{${description.slice(0, 20)}}
  B -->|是| C[执行操作]
  B -->|否| D[备选方案]
  C --> E[结束]
  D --> E`;

    case 'sequence':
      return `sequenceDiagram
  participant U as 用户
  participant S as 服务端
  participant D as 数据库
  U->>S: ${description.slice(0, 30)}
  S->>D: 查询
  D-->>S: 结果
  S-->>U: 响应`;

    case 'class':
      return `classDiagram
  class ${description.slice(0, 20).replace(/\s/g, '')} {
    +field1
    +field2
    +method1()
    +method2()
  }`;

    case 'er':
      return `erDiagram
  ENTITY1 ||--o{ ENTITY2 : ${description.slice(0, 20)}
  ENTITY1 {
    int id PK
    string name
  }
  ENTITY2 {
    int id PK
    int entity1_id FK
  }`;

    case 'state':
      return `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing: ${description.slice(0, 20)}
  Processing --> Done
  Done --> [*]`;

    default:
      return `graph TD\n  A[${description.slice(0, 40)}] --> B[处理]`;
  }
}
