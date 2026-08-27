/*
 * Author: MoyuZJ
 * Team: LinearTeam
 * Contact: linearteam@foxmail.com
 * Made by MoyuZJ in China with ♥
 */

/**
 * 说说内容渲染与净化。
 *
 * 说说只允许「一个段落 + 行内文本样式」，存储格式与 modern-editor 的 block
 * 结构兼容：content_json = [{ type: 'paragraph', contentHtml: '<b>…</b>' }]，
 * 也兼容 modern-editor 保存时包裹的 custom-html marker 块。
 *
 * 渲染前对行内 HTML 做白名单净化：
 *  - 允许的行内标签：strong/b/em/i/u/s/del/span/br/code/mark/font；
 *  - 允许的 CSS 属性：颜色、背景色、字号、下划线/删除线、字重、斜体；
 *  - 块级标签与脚本一律剥离，防止存储型 XSS。
 */

/** modern-editor 保存时会把区块包裹成 custom-html marker。 */
export const MODERN_MARKER = 'LP-MODERN-BLOCK::';

/** 允许的行内标签（除 br 外均以成对标签处理，font 归一化为 span）。 */
const ALLOWED_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'SPAN', 'BR', 'CODE', 'MARK', 'FONT']);
/** 允许的 CSS 属性（仅保留纯色/简单数值，杜绝表达式与 url() 注入）。 */
const ALLOWED_STYLES = new Set(['color', 'background-color', 'font-size', 'text-decoration-line', 'text-decoration-style', 'font-weight', 'font-style']);
const STYLE_VALUE_PATTERN = /^[#\w (),.%+-]+$/;

export interface ShuoShuoBlock { type?: string; content?: unknown; contentHtml?: unknown; [key: string]: unknown; }

/** HTML 转义。 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]!));
}

/** 纯文本安全化：转义 + 换行转 <br>（保留段内换行）。 */
function safeText(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

/**
 * 行内富文本净化。
 * - 无任何标签 → 按纯文本处理（转义 + 换行）；
 * - 含标签 → 标签白名单过滤，style 白名单过滤，其余内容原样保留。
 */
export function sanitizeInlineHtml(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (!/<[a-z][^>]*>/i.test(raw)) return safeText(raw.replace(/\s+/g, ' '));
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?([a-z][\w-]*)([^>]*)>/gi, (full, tagName: string, attrs: string) => {
      const tag = tagName.toLowerCase();
      if (tag === 'br') return '<br>';
      if (!ALLOWED_TAGS.has(tag.toUpperCase())) return ''; // 剥离块级/未知标签，保留文本内容
      if (full.startsWith('</')) return `</${tag === 'font' ? 'span' : tag}>`;
      const rules: string[] = [];
      const styleMatch = attrs.match(/\sstyle\s*=\s*["']([^"']*)["']/i);
      if (styleMatch) rules.push(...styleMatch[1].split(';'));
      if (tag === 'font') {
        const color = attrs.match(/\scolor\s*=\s*["']?([#\w(),.%+-]+)["']?/i)?.[1];
        if (color && /^[#\w(),.%+-]+$/.test(color)) rules.push(`color:${color}`);
        const size = attrs.match(/\ssize\s*=\s*["']?(\d+)["']?/i)?.[1];
        if (size) rules.push(`font-size:${Math.min(7, Math.max(1, Number(size))) * 4 + 8}px`);
      }
      const style = rules
        .map((rule) => rule.trim())
        .filter((rule) => {
          const [property, ...parts] = rule.split(':');
          const value = parts.join(':').trim();
          return ALLOWED_STYLES.has(property.trim().toLowerCase()) && STYLE_VALUE_PATTERN.test(value);
        })
        .join(';');
      return style ? `<${tag === 'font' ? 'span' : tag} style="${escapeHtml(style)}">` : `<${tag === 'font' ? 'span' : tag}>`;
    });
}

/** 解码 modern-editor 的 custom-html marker 块；非 marker 返回原对象。 */
export function decodeMarker(block: ShuoShuoBlock): ShuoShuoBlock {
  if (String(block.type ?? '') !== 'custom-html') return block;
  const raw = String(block.content ?? '');
  if (!raw.startsWith(MODERN_MARKER)) return block;
  try {
    const decoded = Buffer.from(raw.slice(MODERN_MARKER.length), 'base64').toString('utf8');
    const value = JSON.parse(decoded) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as ShuoShuoBlock;
  } catch { /* 解码失败按原块处理 */ }
  return block;
}

/** 提取说说正文 HTML（净化后，不含外层 <p>）。 */
export function extractShuoShuoHtml(blocks: unknown): string {
  const list = Array.isArray(blocks) ? blocks : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const block = decodeMarker(item as ShuoShuoBlock);
    if (String(block.type ?? '') !== 'paragraph') continue;
    const content = String(block.contentHtml ?? block.content ?? '');
    const html = sanitizeInlineHtml(content);
    if (!html) continue;
    return String(html).trim().replace(/^<p[^>]*>|<\/p>$/gi, '');
  }
  return '';
}

/** 渲染说说为完整 HTML 片段（单段落）。 */
export function renderShuoShuoHtml(blocks: unknown): string {
  const html = extractShuoShuoHtml(blocks);
  if (!html) return '';
  return `<div class="shuoshuo-body"><p class="shuoshuo-paragraph">${html}</p></div>`;
}

/** 从净化后的行内 HTML 中提取纯文本（用于空内容校验）。 */
export function textOfHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

/** 保存时校验并标准化说说正文：必须以单段落块存储。 */
export function normalizeShuoShuoBlocks(blocks: unknown): string {
  const list = Array.isArray(blocks) ? blocks : [];
  if (list.length !== 1) throw new Error('说说只能包含一个段落。');
  const block = decodeMarker(list[0] as ShuoShuoBlock);
  if (String(block.type ?? '') !== 'paragraph') throw new Error('说说正文只能使用普通段落样式。');
  const html = sanitizeInlineHtml(String(block.contentHtml ?? block.content ?? '').trim().replace(/^<p[^>]*>|<\/p>$/gi, ''));
  if (!textOfHtml(html)) throw new Error('说说内容不能为空。');
  return String(html).trim();
}