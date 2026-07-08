/**
 * PPT 生成工具
 * 根据描述生成 .pptx 文件
 */
const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

module.exports = async function createPPTX({ path: filePath, title, slides }, context) {
  // 用户未指定路径时使用默认路径
  if (!filePath && context?.config?.defaultSavePath) {
    const dir = context.config.defaultSavePath.replace(/^~/, require('os').homedir());
    const ts = new Date().toISOString().slice(0,10);
    filePath = require('path').join(dir, `AI-Shell-${ts}.pptx`);
  }
  const absPath = require('path').resolve(filePath || 'output.pptx');

  if (!title && (!slides || slides.length === 0)) {
    return '错误: 至少需要标题(title)或幻灯片内容(slides)';
  }

  try {
    const pptx = new PptxGenJS();

    // 设置默认样式
    pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
    pptx.layout = 'CUSTOM';

    // 解析 slides 参数
    let slideList = slides;
    if (typeof slideList === 'string') {
      try { slideList = JSON.parse(slideList); } catch (e) {
        // 把文本按段落分，每段一页
        slideList = slides.split('\n\n').filter(s => s.trim()).map(text => ({
          title: text.split('\n')[0].slice(0, 80),
          content: text,
        }));
      }
    }

    if (!Array.isArray(slideList) || slideList.length === 0) {
      // 只有标题，创建单页
      slideList = [{ title: title || '演示文稿', content: '' }];
    }

    // 封面
    if (title) {
      const cover = pptx.addSlide();
      cover.background = { fill: '1a1a2e' };
      cover.addText(title, {
        x: 1, y: 2.5, w: 11, h: 1.5,
        fontSize: 40, bold: true, color: 'FFFFFF',
        align: 'center', fontFace: 'Microsoft YaHei',
      });
      cover.addText('AI-Shell 生成', {
        x: 1, y: 4.2, w: 11, h: 0.5,
        fontSize: 16, color: '888888', align: 'center',
      });
    }

    // 内容页
    for (const slide of slideList) {
      const s = pptx.addSlide();
      s.background = { fill: 'FFFFFF' };

      // 标题
      if (slide.title) {
        s.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11.5, h: 0.8,
          fontSize: 28, bold: true, color: '1a1a2e',
          fontFace: 'Microsoft YaHei',
        });
        // 标题下划线
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 1.25, w: 3, h: 0.04, fill: '4fc3f7',
        });
      }

      // 正文
      const content = slide.content || slide.text || '';
      if (content) {
        const lines = content.split('\n').filter(l => l.trim());
        const bullets = lines.map(line => ({
          text: line.replace(/^[-•*]\s*/, ''),
          options: { fontSize: 16, color: '333333', fontFace: 'Microsoft YaHei', bullet: true },
        }));

        s.addText(bullets, {
          x: 0.8, y: 1.6, w: 11.5, h: 5.5,
          valign: 'top',
        });
      }

      // 页码
      s.addText(`${pptx.slides.length}`, {
        x: 12, y: 7, w: 1, h: 0.4,
        fontSize: 10, color: 'BBBBBB', align: 'right',
      });
    }

    // 保存
    await pptx.writeFile({ fileName: absPath });

    const stat = fs.statSync(absPath);
    return `PPT 已生成: ${absPath}\n大小: ${(stat.size / 1024).toFixed(1)} KB\n页数: ${pptx.slides.length} 页`;
  } catch (err) {
    return `错误: 生成 PPT 失败: ${err.message}`;
  }
};
