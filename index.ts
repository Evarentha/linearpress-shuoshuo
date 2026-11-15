/*
 * Shuoshuo Plugin Entry Point
 *
 * Short posts ("说说"): one paragraph of inline rich text, shown in full on a timeline.
 *
 * Authors:
 * MoyuZJ <moyuzj@evarentha.com> @LinearTeam - Made in China with ♥
 * worryzu <worryzu@evarentha.com> @LinearTeam
 *
 * Copyright (C) 2026 Evarentha
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * <p>Registers the <code>shuoshuo</code> content type (not routable, not in
 * post lists) and a <code>shuoshuo</code> block renderer. Posting happens in
 * a composer at the top of the admin page; readers see a /shuoshuo timeline
 * and a "recent" section on the home page. 3.x records (posts with the
 * reserved_shuoshuo_ slug prefix) are converted once at startup.</p>
 *
 * @since 1.0.0
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context } from 'cordis';
import type { Request, Response } from 'express';
import { checkPermission, requireAuth, route, parseId, parsePage, pager, messageOf, registerBlock, safeBack } from 'linearpress/plugin-api';
import type { Post, PostStatus, PostWithAuthor } from 'linearpress/plugin-api';
import { MAX_TEXT, legacyHtml, normalize, renderHtml, sanitizeInline } from './src/render.js';

const PLUGIN_ID = 'shuoshuo';
const TYPE = 'shuoshuo';
const VIEWS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'views', PLUGIN_ID);
const LEGACY_PREFIX = 'reserved_shuoshuo_';
const PER_PAGE = 20;

interface Options { homeCount: number; migrated?: number; }

export default async function shuoshuo(ctx: Context): Promise<void> {
  const { web, ui, admin } = ctx.linearpress;
  const db = () => ctx.databaseService;

  ctx.contentTypes.register({ id: TYPE, label: '说说', routable: false, titleRequired: false, listed: false });
  registerBlock(TYPE, (block) => renderHtml((block as { html?: unknown }).html));

  let options: Options = { homeCount: 3, ...(await ctx.plugins.getConfig<Partial<Options>>(PLUGIN_ID) ?? {}) };
  if (!options.migrated) {
    const legacy = await db().all<{ id: number; content_json: string }>(`SELECT id, content_json FROM posts WHERE post_type = 'post' AND SUBSTR(slug, 1, ${LEGACY_PREFIX.length}) = ?`, LEGACY_PREFIX);
    for (const row of legacy) {
      let blocks: unknown = [];
      try { blocks = JSON.parse(row.content_json); } catch { /* keep empty */ }
      await db().run('UPDATE posts SET post_type = ?, content_json = ?, html_cache = NULL WHERE id = ?', TYPE, JSON.stringify([{ type: TYPE, html: legacyHtml(blocks) }]), row.id);
    }
    options = { ...options, migrated: 1 };
    await ctx.plugins.setConfig(PLUGIN_ID, options);
    if (legacy.length) ctx.logger.info(`converted ${legacy.length} shuoshuo from 3.x`);
  }

  const htmlOf = (post: Post) => String((post.content_json.find((block) => block.type === TYPE) as { html?: unknown } | undefined)?.html ?? '');
  const prepare = async (posts: PostWithAuthor[]) => Promise.all(posts.map(async (post) => ({ ...post, html: await ctx.posts.render(post) })));
  const find = async (id: number | undefined) => { const post = id ? await ctx.posts.findById(id) : undefined; return post?.post_type === TYPE ? post : undefined; };

  async function save(req: Request, input: { id?: number; html: unknown; status: PostStatus }): Promise<Post> {
    const existing = await find(input.id);
    if (input.id && !existing) throw new Error('这条说说已不存在');
    const html = normalize(input.html);
    return ctx.posts.save({
      id: existing?.id, type: TYPE, title: '', slug: existing?.slug ?? `shuoshuo-${crypto.randomBytes(6).toString('hex')}`,
      blocks: [{ type: TYPE, html } as never], status: input.status, authorId: existing?.author_id ?? req.session.userId!
    });
  }

  /* ---------- admin ---------- */
  admin.registerMenu({ title: '说说', link: '/admin/shuoshuo', group: 'content', order: 15, permission: 'post:create' });
  web.register('get', '/admin/shuoshuo', requireAuth, checkPermission('post:create'), route(async (req, res) => {
    const status = (['published', 'draft'] as const).find((value) => value === req.query.status);
    const total = await ctx.posts.count({ type: TYPE, status });
    const pages = pager(total, parsePage(req.query.page), PER_PAGE, '/admin/shuoshuo', { status });
    const items = await prepare(await ctx.posts.list({ type: TYPE, status, limit: pages.perPage, offset: pages.offset }));
    const editing = await find(parseId(req.query.edit));
    const draft = req.session.shuoshuoDraft; req.session.shuoshuoDraft = undefined;
    const [published, drafts] = await Promise.all([ctx.posts.count({ type: TYPE, status: 'published' }), ctx.posts.count({ type: TYPE, status: 'draft' })]);
    res.render(`${PLUGIN_ID}/admin`, {
      pageTitle: '说说', items, pager: pages, status: status ?? '', counts: { all: published + drafts, published, drafts },
      composer: { id: editing?.id ?? '', html: sanitizeInline(draft?.html ?? (editing ? htmlOf(editing) : '')), error: draft?.error ?? '', status: editing?.status ?? 'draft' },
      maxText: MAX_TEXT, options,
      can: { delete: Boolean(await ctx.permissions.has(req.session.userId!, 'post:delete')) }
    });
  }));
  web.register('post', '/admin/shuoshuo/save', requireAuth, checkPermission('post:create'), route(async (req, res) => {
    const id = parseId(req.body.id);
    if (id && !await ctx.permissions.has(req.session.userId!, 'post:edit')) return void res.status(403).render('error', { pageTitle: '没有权限', title: '没有权限', message: '你没有编辑说说的权限。', code: 403 });
    const status: PostStatus = req.body.intent === 'draft' ? 'draft' : 'published';
    try {
      await save(req, { id, html: req.body.html, status });
      req.flash('success', status === 'published' ? (id ? '说说已更新' : '说说已发布') : '已存为草稿');
      res.redirect(303, '/admin/shuoshuo');
    } catch (error) {
      req.session.shuoshuoDraft = { html: String(req.body.html ?? ''), error: messageOf(error) };
      res.redirect(303, id ? `/admin/shuoshuo?edit=${id}#composer` : '/admin/shuoshuo#composer');
    }
  }));
  web.register('post', '/admin/shuoshuo/:id/delete', requireAuth, checkPermission('post:delete'), route(async (req, res) => {
    const post = await find(parseId(req.params.id));
    if (post) { await ctx.posts.remove(post.id); req.flash('success', '已删除这条说说'); }
    else req.flash('warning', '这条说说已不存在');
    res.redirect(303, safeBack(req.body.back, '/admin/shuoshuo'));
  }));
  web.register('post', '/admin/shuoshuo/options', requireAuth, checkPermission('admin:access'), route(async (req, res) => {
    options = { ...options, homeCount: Math.min(10, Math.max(0, Math.floor(Number(req.body.homeCount)) || 0)) };
    await ctx.plugins.setConfig(PLUGIN_ID, options);
    req.flash('success', options.homeCount ? `首页会显示最近 ${options.homeCount} 条说说` : '首页不再显示说说');
    res.redirect(303, '/admin/shuoshuo');
  }));

  /* ---------- public ---------- */
  ui.menu('web.nav', { title: '说说', href: '/shuoshuo', order: 20 });
  web.register('get', '/shuoshuo', route(async (req: Request, res: Response) => {
    const total = await ctx.posts.count({ type: TYPE, status: 'published' });
    const pages = pager(total, parsePage(req.query.page), PER_PAGE, '/shuoshuo');
    const items = await prepare(await ctx.posts.list({ type: TYPE, status: 'published', limit: pages.perPage, offset: pages.offset }));
    res.render(`${PLUGIN_ID}/timeline`, { pageTitle: '说说', items, pager: pages, total });
  }));
  ui.slot('home.before-latest', {
    match: (req) => req.path === '/' && options.homeCount > 0,
    prepare: async () => {
      const posts = await ctx.posts.list({ type: TYPE, status: 'published', limit: options.homeCount });
      return { items: await prepare(posts), total: await ctx.posts.count({ type: TYPE, status: 'published' }) };
    },
    view: path.join(VIEWS, 'home.ejs')
  });
  ctx.logger.info('activated');
}

declare module 'express-session' {
  interface SessionData { shuoshuoDraft?: { html: string; error: string }; }
}
