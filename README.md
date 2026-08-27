<!--
  Author: MoyuZJ
  Team: LinearTeam
  Contact: linearteam@foxmail.com
  Made by MoyuZJ in China with ♥
-->

# 说说（shuoshuo）

一种只有一段话的文章类型。分享灵光一现的时刻：没有标题、没有阅读页，整段内容直接出现在首页文章列表中。

## 特性

- **单段落约束**：说说只能包含一个段落，段落内仅允许行内文本样式（加粗、斜体、下划线、删除线、字号、文字颜色、背景色）。后端保存时会强制执行白名单净化，块级标签与脚本一律剥离（防存储型 XSS）。
- **兼容现有可视化编辑器**：存储格式与 modern-editor 的 block 结构一致（`[{ type: 'paragraph', contentHtml: '…' }]`），编辑器提供与 modern-editor 一致的浮动行内格式工具栏；该结构也可以被 modern-editor 直接打开编辑。
- **列表页直接展示全文**：覆盖 `web/index` 视图，说说以卡片形式完整展示在首页，不渲染「READ →」阅读链接。
- **无标题、保留 slug**：`title` 为空，slug 固定为 `reserved_shuoshuo_<UUID>`；普通文章保存时若 slug 撞保留前缀会自动交给系统按标题重新生成。
- **阅读页拦截**：注册全局中间件，任何 permalink 形态（`/posts/:slug`、`/posts/:id/:slug`、日期分段、`/post-xxx-page.html` 等）下强行访问说说的文章页面都会返回 404「文章不存在」。
- **后台管理**：独立「说说」菜单与列表页，支持新建、编辑、删除、草稿/发布/归档。

## 开发

```bash
# 在工作区同步插件到运行目录
cd base && sh scripts/sync-plugins.sh shuoshuo
# 校验与启动
npm run typecheck && npm run dev
```

## 结构

```
shuoshuo/
├── plugin.json              # Manifest
├── index.ts                 # 入口：路由、拦截中间件、hooks、视图辅助
├── src/
│   ├── render.ts            # 行内富文本白名单净化 + 说说渲染
│   └── store.ts             # 说说数据访问层（复用 posts 表）
├── views/
│   ├── web/index.ejs        # 覆盖首页列表：说说直接展示全文
│   └── admin/               # 说说管理列表、单段落编辑器
└── public/
    ├── shuoshuo.css         # 列表卡片 + 编辑器样式
    └── shuoshuo-editor.js   # 单段落可视化编辑器
```