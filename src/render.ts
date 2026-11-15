/*
 * Shuoshuo Rendering
 *
 * Sanitizes and renders the single paragraph of inline rich text a shuoshuo consists of.
 *
 * Authors:
 * MoyuZJ <moyuzj@evarentha.com> @LinearTeam - Made in China with ♥
 * worryzu <worryzu@evarentha.com> @LinearTeam
 *
 * Copyright (C) 2026 Evarentha
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * <p>A shuoshuo is stored as one block: <code>{ type: 'shuoshuo', html }</code>.
 * The HTML is sanitized on save and again on render (whitelist of inline tags,
 * a few colour/weight styles, http(s)/mailto links). Older records written by
 * 3.x (custom-html marker or paragraph blocks) are read through
 * {@link legacyHtml} and converted once.</p>
 *
 * @since 1.0.0
 */

export const MAX_TEXT = 2000;
const INLINE = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'del', 'span', 'br', 'code', 'mark', 'font', 'a']);
const STYLES = new Set(['color', 'background-color', 'font-weight', 'font-style', 'text-decoration-line']);
const STYLE_VALUE = /^[#\w (),.%+-]{1,40}$/;

export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]!));
const attr = (attrs: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs)?.slice(1).find((value) => value !== undefined);
const decodeEntities = (value: string) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function safeHref(value: string | undefined): string | undefined {
  const href = decodeEntities(String(value ?? '')).trim();
  return /^(https?:\/\/|mailto:)[^\s"'<>]+$/i.test(href) ? href : undefined;
}

/** Keep only inline formatting; everything else is reduced to its text. Tags are re-balanced. */
export function sanitizeInline(value: unknown): string {
  const raw = String(value ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template|iframe|object)\b[\s\S]*?<\/\1\s*>/gi, '');
  const open: string[] = [];
  // Stray angle brackets are escaped, so fragments like <scr<b>ipt> can never reassemble into a tag.
  let html = raw.replace(/<\/?([a-z][\w-]*)([^<>]*)>|[<>]/gi, (full, name: string | undefined, attrs: string) => {
    if (!name) return full === '<' ? '&lt;' : '&gt;';
    let tag = name.toLowerCase();
    if (!INLINE.has(tag)) return /^(p|div|li|h[1-6]|blockquote|tr)$/.test(tag) && full.startsWith('</') ? '<br>' : '';
    if (tag === 'br') return '<br>';
    if (tag === 'font') tag = 'span';
    if (tag === 'b') tag = 'strong';
    if (tag === 'i') tag = 'em';
    if (full.startsWith('</')) {
      const at = open.lastIndexOf(tag);
      if (at < 0) return '';
      const closing = open.splice(at).reverse().map((t) => `</${t}>`).join('');
      return closing;
    }
    if (tag === 'a') {
      const href = safeHref(attr(attrs, 'href'));
      if (!href) return '';
      open.push('a');
      return `<a href="${escapeHtml(href)}" rel="nofollow noopener noreferrer" target="_blank">`;
    }
    const rules = String(attr(attrs, 'style') ?? '').split(';').map((rule) => rule.trim()).filter((rule) => {
      const [property, ...rest] = rule.split(':');
      return STYLES.has(property.trim().toLowerCase()) && STYLE_VALUE.test(rest.join(':').trim());
    });
    const color = name.toLowerCase() === 'font' ? attr(attrs, 'color') : undefined;
    if (color && /^#?\w{3,20}$/.test(color)) rules.push(`color:${color}`);
    if (tag === 'span' && !rules.length) return '';
    open.push(tag);
    return rules.length ? `<${tag} style="${escapeHtml(rules.join(';'))}">` : `<${tag}>`;
  });
  html += open.reverse().map((tag) => `</${tag}>`).join('');
  // collapse runs of breaks and trim leading/trailing ones
  return html.replace(/(<br>\s*){3,}/g, '<br><br>').replace(/^(\s|<br>)+|(\s|<br>)+$/g, '').replace(/&nbsp;/g, ' ');
}

export const textOf = (html: string): string => decodeEntities(html.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '')).trim();

/** Validate and normalise editor input into the stored HTML. */
export function normalize(html: unknown): string {
  const clean = sanitizeInline(html);
  const text = textOf(clean);
  if (!text) throw Object.assign(new Error('写点什么再发布吧'), { field: 'html' });
  if ([...text].length > MAX_TEXT) throw Object.assign(new Error(`说说最多 ${MAX_TEXT} 字，现在有 ${[...text].length} 字`), { field: 'html' });
  return clean;
}

export const renderHtml = (html: unknown): string => `<p class="shuoshuo-text">${sanitizeInline(html)}</p>`;

/** Inner HTML from a 3.x record (custom-html marker wrapping a paragraph, or a paragraph block). */
export function legacyHtml(blocks: unknown): string {
  for (const item of Array.isArray(blocks) ? blocks : []) {
    if (!item || typeof item !== 'object') continue;
    let block = item as Record<string, unknown>;
    if (block.type === 'shuoshuo') return String(block.html ?? '');
    if (block.type === 'custom-html') {
      if (block.modernBlock && typeof block.modernBlock === 'object') block = block.modernBlock as Record<string, unknown>;
      else {
        const content = String(block.content ?? '');
        if (content.startsWith('LP-MODERN-BLOCK::')) {
          try { block = JSON.parse(Buffer.from(content.slice(17), 'base64').toString('utf8')); } catch { block = { type: 'paragraph', contentHtml: '' }; }
        } else block = { type: 'paragraph', contentHtml: content };
      }
    }
    if (block.type === 'paragraph') return sanitizeInline(block.contentHtml ?? escapeHtml(block.content ?? ''));
  }
  return '';
}
