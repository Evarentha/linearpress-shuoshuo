<!--
  Author: MoyuZJ
  Team: LinearTeam
  Contact: linearteam@foxmail.com
  Made by MoyuZJ in China with ♥
-->

# 说说 · Shuoshuo

A one-paragraph post type for LinearPress: **no title, no reading page** — the whole content appears directly on the home page list. A lightweight way to share fleeting thoughts.

LinearPress 的一种只有一段话的文章类型：**没有标题、没有阅读页**，整段内容直接出现在首页文章列表中，是分享灵光一现时刻的轻量发布方式。

> Independent plugin repository for LinearPress **shuoshuo**. A plugin is a Cordis plugin function — install on demand, disable/uninstall cleanly.
> 本仓库是 LinearPress 插件 **shuoshuo** 的独立仓库。

## Why Plugins? / 插件化的优势

- **Add a content type without forking core** —— reuses the `posts` table; a hook（`post:beforeSave`）plus a view override adds a whole new content form.
  **给文章系统加类型不 fork 核心**——复用 `posts` 表，靠一个钩子 + 视图覆盖就新增了一种内容形态。
- **Coexists with the visual editor** —— storage format is compatible with modern-editor's block structure; both can open/edit interchangeably; `ctx.posts` is never replaced.
  **与可视化编辑器互不干扰**——存储格式兼容 modern-editor 的 block 结构；不替换 `ctx.posts`。
- **Clean uninstall** —— stop the plugin and the home list returns to default; no leftover table migrations.
  **卸载干净**——停用后首页回到默认列表，无任何残留。

## Features / 功能

- **Single paragraph constraint / 单段落约束**：inline styles only（bold/italic/underline/strikethrough/size/color/bg）；server whitelist sanitization blocks block-level tags & scripts（defense against stored XSS）.
  只允许单段落与行内样式；后端白名单净化，防存储型 XSS。
- **Visual editor compatible / 兼容可视化编辑器**：`[{ type: 'paragraph', contentHtml: '…' }]` blocks editable in modern-editor too.
- **Full text on the list / 列表页直接展示全文**：overrides `web/index`, no「READ →」link.
- **No title, reserved slug / 无标题、保留 slug**：`reserved_shuoshuo_<UUID>`；ordinary posts crossing the prefix get auto re-slugged.
- **Reading page blocked / 阅读页拦截**：any permalink form returns 404 for shuoshuo posts.
- **Admin management / 后台管理**：own menu & list page with new/edit/delete and draft/publish/archive status.

## Install / 安装

```bash
# Option 1 — workspace sync（工作区同步）
cd base && sh scripts/sync-plugins.sh shuoshuo

# Option 2 — clone into runtime dir（目录名必须等于插件 id）
git clone https://github.com/Averithen/linearpress-shuoshuo src/plugins/shuoshuo
```

Restart LinearPress to discover and enable; or install via admin ZIP upload. / 重启自动发现启用；也可 ZIP 安装。

## Local Development / 本地开发：怎么拉 / 怎么改 / 怎么跑

```bash
git clone https://github.com/Averithen/linearpress-shuoshuo LinearPress/Plugins/shuoshuo
cd LinearPress/base
npm install && npm run db:init
sh scripts/sync-plugins.sh shuoshuo
npm run dev                             # → http://localhost:3000
```

## Directory / 目录结构

```text
shuoshuo/
├── plugin.json            # Manifest
├── index.ts               # entry：routes, blocking middleware, hooks, view helpers
├── src/
│   ├── render.ts          # inline rich-text whitelist sanitizer + rendering
│   └── store.ts           # data access（reuses posts table）
├── views/
│   ├── web/index.ejs      # overrides home list：full text
│   └── admin/             # manage list + single-paragraph editor
└── public/
    ├── shuoshuo.css
    └── shuoshuo-editor.js
```

## Contribute & Release / 贡献与发布

- conventional commits；`cd base && npm run typecheck` before commit
- Version：`git tag v1.0.0 && git push --tags`
- License：MIT（LICENSE）