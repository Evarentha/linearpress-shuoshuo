# 说说（shuoshuo）

[![LinearPress](https://img.shields.io/badge/LinearPress-plugin-7C3AED.svg)](https://www.npmjs.com/package/@evarentha/linearpress) [![npm](https://img.shields.io/npm/v/@evarentha/linearpress-shuoshuo.svg)](https://www.npmjs.com/package/@evarentha/linearpress-shuoshuo) [![Node.js](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org) [![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)

[English](README.md) | **简体中文**

为 LinearPress 增加微博式的「说说」内容类型。说说没有标题、仅有一段文字；首页列表将全文渲染为卡片；不设阅读页，访问固定链接一律返回 404，此为设计使然。编辑器需要浏览器启用 JavaScript。

## 安装

```bash
git clone https://github.com/Evarentha/linearpress-shuoshuo.git src/plugins/shuoshuo
```

目录名必须与插件 id 一致，安装后需重启 LinearPress。也可以在 `base` 检出中执行 `sh scripts/sync-plugins.sh shuoshuo`，或在后台插件页上传 ZIP、填写 npm 包名。本插件没有任何可配置项：没有设置页、没有配置键，每次保存直接选择状态（草稿、发布或归档）。

管理页使用基础文章权限：列表与编辑已有说说需要 `post:edit`，创建需要 `post:create`，删除需要 `post:delete`。列表位于 `/admin/shuoshuo`，后台菜单设有独立入口。需要注意：本插件对后台文章列表的覆盖仅在未安装 advanced-posts-list 时生效（该插件注册了同一路由，且其列表不会为说说行添加标记）。

## 撰写

编辑器为单段落 contenteditable。回车插入换行而非新段落；粘贴带入的块级容器将被剥离，内容始终保持单段。选中文本弹出浮动栏：加粗、斜体、下划线、删除线、字号增减、文字颜色、背景色；旧的 `font` 标签归一为 `span`。本地草稿每 30 秒保存一次至 localStorage；当本地版本较已保存版本更新时，系统提示恢复；携带未保存修改离开页面前将收到警告。

内容在保存与渲染时各净化一次。仅行内标签 `strong`、`b`、`em`、`i`、`u`、`s`、`del`、`span`、`br`、`code`、`mark` 可以保留（`font` 转换为 `span`）；属性仅放行一组白名单样式；脚本与注释一律移除，存储型 XSS 由此封堵。

## 存储

不创建新表、不执行迁移。一条说说即核心 `posts` 表中的一行：标题为空、slug 形如 `reserved_shuoshuo_<UUID>`、`content_json` 内为单个段落块，结构与 modern-editor 读写的一致。`LP-MODERN-BLOCK::` 标记块将被解码并重新净化，因此两个编辑器均可打开同一条说说。停用本插件后普通文章照常工作，仅保留前缀的保护不再生效。

`post:beforeSave` Hook 将清空与保留前缀冲突的普通文章的 slug，由系统依据标题重新生成；一个运行于核心路由之前的 404 中间件按前缀匹配全部固定链接形态，后台、API 与插件资产路径不受影响。

## 面向主题

`isShuoShuo(slug)` 与 `shuoshuoHtml(post)` 经 `site:locals` 按请求注入，任何主题均可据此识别说说并渲染全文卡片，fluentui-theme 已经实现此项支持。本插件覆盖首页列表与后台文章列表；主题覆盖同一视图时，生效方由后台插件页的加载顺序决定。

## 许可证

本项目以 GPL-3.0-or-later 许可发布，Copyright (C) 2026 Evarentha，完整文本见 [LICENSE](LICENSE)。
