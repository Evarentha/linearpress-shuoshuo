/*
 * Author: MoyuZJ
 * Team: LinearTeam
 * Contact: linearteam@foxmail.com
 * Made by MoyuZJ in China with ♥
 */

/**
 * 说说插件（Cordis 原生插件）。
 *
 * 功能：
 *  1. 新增一种文章类型「说说」：复用 posts 表，title 为空，slug 使用保留前缀
 *     reserved_shuoshuo_<UUID>，内容为单段落（仅允许行内文本样式：加粗/颜色等），
 *     存储格式与 modern-editor 的 block 结构兼容。
 *  2. 首页列表直接完整展示说说正文（覆盖 web/index 视图），不可进入阅读页；
 *     通过任何 permalink 形态强行访问说说的文章页面都会返回 404。
 *  3. 后台提供独立的说说管理页与单段落可视化编辑器（行内格式工具栏，
 *     与 modern-editor 交互一致）。
 *  4. 保护保留前缀：普通文章保存时若 slug 撞前缀则自动重新生成。
 */

import type { Context } from 'cordis';
import type { Request, RequestHandler, Response } from 'express';
import { checkPermission, requireAuth } from '../../services/permission.service.js';
import type { Post, PostStatus } from '../../types/index.js';
import type { DatabaseService } from '../../types/services.js';
import { normalizeShuoShuoBlocks, renderShuoShuoHtml } from './src/render.js';
import { findShuoShuo, isShuoShuoSlug, listShuoShuo, nextShuoShuoSlug, removeShuoShuo, saveShuoShuo, type ShuoShuoDatabase } from './src/store.js';

const MANAGE_PAGE = '/admin/shuoshuo';
const EDIT_PAGE = '/admin/shuoshuo/:id/edit';
const SAVE_URL = '/admin/shuoshuo/save';
const DELETE_URL = '/admin/shuoshuo/:id/delete';
const NEW_URL = '/admin/shuoshuo/new';
const POST_STATUSES: PostStatus[] = ['draft', 'published', 'archived'];

function param(value: string | string[]): string { return Array.isArray(value) ? value[0] ?? '' : value; }
function messageOf(error: unknown): string { return error instanceof Error ? error.message : '操作失败'; }
const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown): RequestHandler => (req, res, next) => {
  void Promise.resolve(fn(req, res)).catch((error) => {
    console.error('[shuoshuo] handler error:', error);
    if (!res.headersSent) res.status(400).render('error', { title: '说说操作失败', message: messageOf(error) });
    else next(error);
  });
};
function dbOf(context: Context): ShuoShuoDatabase { return context.databaseService as unknown as ShuoShuoDatabase; }
function statusOf(value: unknown): PostStatus { return POST_STATUSES.includes(value as PostStatus) ? value as PostStatus : 'draft'; }

export default function shuoShuo(context: Context): void {
  const { web, hooks } = context.linearpress;
  const db = dbOf(context);

  // ------------------------------------------------------------ 阅读页拦截
  // 说说的 slug 为保留前缀，任何 permalink 形态（/posts/:slug、/posts/:id/:slug、
  // 日期分段、/post-xxx-page.html 等）都包含该前缀；后台与资源路径除外。
  // 中间件在核心路由之前执行（app.ts：middlewares 先于 router.applyToApp）。
  web.middleware((req, res, next) => {
    const path = req.path;
    if (path === '/' || path.startsWith('/admin') || path.startsWith('/api') || path.startsWith('/plugins') || path.startsWith('/css/') || path.startsWith('/js/') || path === '/favicon.ico') return next();
    if (path.includes('reserved_shuoshuo_')) {
      return void res.status(404).render('error', { title: '未找到', message: '文章不存在或尚未发布。' });
    }
    next();
  });

  // ------------------------------------------------------------ 说说管理列表
  web.register('get', MANAGE_PAGE, requireAuth, checkPermission('post:edit'), wrap(async (_req, res) => {
    const items = await listShuoShuo(db);
    res.render('admin/shuoshuo', { title: '说说', items, notice: _req.query.notice ?? '' });
  }));

  // ------------------------------------------------------------ 新建 / 编辑
  const blankEditor: RequestHandler = wrap(async (_req, res) => {
    const slug = await nextShuoShuoSlug(db);
    res.render('admin/shuoshuo-edit', { title: '发一条说说', shuoshuo: null, slug, status: 'draft', initialHtml: '', cloudSavedAt: 0 });
  });
  web.register('get', NEW_URL, requireAuth, checkPermission('post:create'), blankEditor);

  const editEditor: RequestHandler = wrap(async (req, res) => {
    const row = await findShuoShuo(db, Number(param(req.params.id)));
    if (!row) return void res.status(404).render('error', { title: '未找到', message: '说说不存在或已被删除。' });
    res.render('admin/shuoshuo-edit', {
      title: '编辑说说',
      shuoshuo: { id: row.id, status: row.status, updated_at: row.updated_at },
      slug: row.slug,
      status: row.status,
      initialHtml: extractParagraphHtml(row.content_json),
      cloudSavedAt: row.updated_at ? Date.parse(row.updated_at) || 0 : 0
    });
  });
  web.register('get', EDIT_PAGE, requireAuth, checkPermission('post:edit'), editEditor);

  // ------------------------------------------------------------ 保存
  web.register('post', SAVE_URL, requireAuth, wrap(async (req, res) => {
    const id = Number(req.body.id) || undefined;
    const permission = id ? 'post:edit' : 'post:create';
    if (!await context.permissions.has(req.session.userId!, permission)) {
      return void res.status(403).render('error', { title: '权限不足', message: '你没有执行此操作的权限。' });
    }
    let blocks: unknown;
    try { blocks = JSON.parse(String(req.body.content_json ?? '[]')); }
    catch { return void res.status(400).render('error', { title: '内容无效', message: '说说内容格式无法解析。' }); }
    const html = normalizeShuoShuoBlocks(blocks);
    let slug = String(req.body.slug ?? '');
    // 编辑器会附带隐藏 slug；缺失或非法时（如直接 API 调用）自动生成保留前缀 slug。
    if (!isShuoShuoSlug(slug)) slug = await nextShuoShuoSlug(db);
    await saveShuoShuo(db, { id, slug, html, status: statusOf(req.body.status), authorId: req.session.userId! });
    res.redirect(`${MANAGE_PAGE}?notice=saved`);
  }));

  // ------------------------------------------------------------ 删除
  web.register('post', DELETE_URL, requireAuth, checkPermission('post:delete'), wrap(async (req, res) => {
    await removeShuoShuo(db, Number(param(req.params.id)));
    res.redirect(`${MANAGE_PAGE}?notice=deleted`);
  }));

  // ------------------------------------------------------------ 后台扩展
  hooks.on('admin:menu', (menu: Array<{ title: string; link: string }>) => [...menu, { title: '说说', link: MANAGE_PAGE }], { priority: 5 });

  // 视图辅助：前端列表 / 后台列表直接渲染说说正文（覆盖视图中使用）。
  hooks.on('site:locals', (locals: Record<string, unknown>) => ({
    ...locals,
    isShuoShuo: (value: string | null | undefined) => isShuoShuoSlug(value),
    shuoshuoHtml: (post: Post) => renderShuoShuoHtml(post?.content_json)
  }));

  // 保留前缀保护：普通文章保存时若 slug 撞保留前缀，交给系统按标题重新生成。
  hooks.on('post:beforeSave', (draft) => (isShuoShuoSlug(String(draft.slug ?? '')) ? { ...draft, slug: '' } : draft));

  context.logger.info('activated');
}

/** 从 content_json 提取说说段落内部 HTML（净化后，不含外层 <p>）。 */
function extractParagraphHtml(contentJson: unknown): string {
  try {
    const blocks = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
    const html = normalizeShuoShuoBlocks(blocks);
    return html.replace(/^<p[^>]*>|<\/p>$/gi, '');
  } catch {
    // 已存在但格式异常的历史数据：编辑页允许空白内容，保存时再校验。
    return '';
  }
}