/*
 * Shuoshuo Data Access Layer
 *
 * Queries and persistence for shuoshuo posts on top of the shared posts table.
 *
 * Authors:
 * MoyuZJ <moyuzj@moyuzj.cn> @LinearTeam - Made in China with ♥
 * worryzu <worryzu@gmail.com> @LinearTeam
 *
 * Copyright (C) 2026 Evarentha
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Shuoshuo data access layer.
 *
 * <p>Shuoshuo reuses the posts table: the title is an empty string, the
 * slug uses the reserved reserved_shuoshuo_ prefix plus a UUID, and
 * content_json holds a single paragraph block (with sanitized inline
 * HTML). This module depends only on a minimal DatabaseService interface,
 * not on Base internals.</p>
 * @since 1.0.0
 */

import crypto from 'node:crypto';
import type { Block, PostStatus } from '../../../types/index.js';
import type { PostService } from '../../../types/services.js';

/** 说说 slug 保留前缀（普通文章不允许使用）。 */
export const SHUOSHUO_SLUG_PREFIX = 'reserved_shuoshuo_';

export interface ShuoShuoDatabase {
  all<T>(sql: string, ...params: unknown[]): Promise<T[]> | T[];
  get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> | T | undefined;
  run(sql: string, ...params: unknown[]): Promise<unknown> | unknown;
}

export interface ShuoShuoRow {
  id: number;
  title: string;
  slug: string;
  /** 解析后的 block 数组（与核心 Post.content_json 一致）。 */
  content_json: unknown;
  status: string;
  author_id: number;
  views: number;
  created_at: string;
  updated_at: string | null;
}

export function isShuoShuoSlug(slug: string | null | undefined): boolean {
  return Boolean(slug && slug.startsWith(SHUOSHUO_SLUG_PREFIX));
}

/** 生成不冲突的说说 slug：reserved_shuoshuo_ + UUID（v4 随机）。 */
export async function nextShuoShuoSlug(db: ShuoShuoDatabase): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = `${SHUOSHUO_SLUG_PREFIX}${crypto.randomUUID()}`;
    const existing = await db.get<{ id: number }>('SELECT id FROM posts WHERE slug=?', slug);
    if (!existing) return slug;
  }
  throw new Error('生成说说固定链接失败，请重试。');
}

/** 精确匹配说说前缀的 SQL 片段（LIKE 的 _ 是通配符，需转义）。 */
const SHUOSHUO_MATCH = `SUBSTR(slug, 1, ${SHUOSHUO_SLUG_PREFIX.length})=?`;

function hydrate(row: ShuoShuoRow & { content_json: string } | undefined): ShuoShuoRow | undefined {
  if (!row) return undefined;
  let blocks: unknown = [];
  try { blocks = JSON.parse(row.content_json); } catch { /* 历史脏数据保持空 */ }
  return { ...row, content_json: blocks };
}

/** 列出全部说说（含草稿），倒序。 */
export async function listShuoShuo(db: ShuoShuoDatabase): Promise<Array<ShuoShuoRow & { author_name: string }>> {
  const rows = await db.all<ShuoShuoRow & { author_name: string; content_json: string }>(
    `SELECT posts.*, users.username AS author_name FROM posts JOIN users ON users.id = posts.author_id
     WHERE SUBSTR(posts.slug, 1, ${SHUOSHUO_SLUG_PREFIX.length})=? ORDER BY posts.created_at DESC, posts.id DESC`,
    SHUOSHUO_SLUG_PREFIX
  );
  return rows.map((row) => ({ ...hydrate(row)!, author_name: row.author_name })).filter(Boolean);
}

/** 查找单条说说；非说说文章返回 undefined。 */
export async function findShuoShuo(db: ShuoShuoDatabase, id: number): Promise<ShuoShuoRow | undefined> {
  const row = await db.get<ShuoShuoRow & { content_json: string }>(`SELECT * FROM posts WHERE id=? AND ${SHUOSHUO_MATCH}`, id, SHUOSHUO_SLUG_PREFIX);
  return hydrate(row);
}

/** 新建或更新说说。html 为净化后的行内 HTML；content_json 存单段落块。 */
export async function saveShuoShuo(db: ShuoShuoDatabase, posts: PostService, input: { id?: number; slug: string; html: string; status: PostStatus; authorId: number }): Promise<ShuoShuoRow> {
  const existing = input.id ? await findShuoShuo(db, input.id) : undefined;
  if (input.id && !existing) throw new Error('说说不存在。');
  const savedPost = await posts.save({ id: input.id, title: '', slug: existing?.slug ?? input.slug, blocks: [{ type: 'custom-html', content: `<p>${input.html}</p>`, modernBlock: { type: 'paragraph', contentHtml: input.html } }] as unknown as Block[], status: input.status, authorId: existing?.author_id ?? input.authorId, postType: 'shuoshuo' });
  const saved = await findShuoShuo(db, savedPost.id);
  if (!saved) throw new Error('说说保存失败。');
  return saved;
}

/** 删除说说。 */
export async function removeShuoShuo(db: ShuoShuoDatabase, posts: PostService, id: number): Promise<void> {
  const existing = await findShuoShuo(db, id);
  if (!existing) throw new Error('说说不存在。');
  await posts.remove(id);
}