# 说说

[![LinearPress](https://img.shields.io/badge/LinearPress-plugin-7C3AED.svg)](https://www.npmjs.com/package/@evarentha/linearpress) [![npm](https://img.shields.io/npm/v/@evarentha/linearpress-shuoshuo.svg)](https://www.npmjs.com/package/@evarentha/linearpress-shuoshuo) [![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)

[English](README.md) | **简体中文**

为 LinearPress 提供“说说”短内容。

## 功能

- 只有一个段落、没有标题；支持加粗、高亮和链接。
- 在 /shuoshuo 以时间线展示，首页显示最近几条。
- 作为独立的内容类型保存，不会混进文章列表。

## 入口

- `/admin/shuoshuo`：发布和管理说说

## 安装

LinearPress 4 已内置。在后台“插件”页启用或停用，立即生效，无需重启。其他安装方式：在 LinearPress 目录执行 `npm run sync -- shuoshuo`，或把本仓库放到 `src/plugins/shuoshuo`（目录名必须等于插件 id）。

需要 LinearPress ^4.0.0，支持 SQLite 和 MySQL。

## 许可

GPL-3.0-or-later，见 [LICENSE](LICENSE)。

源码：https://github.com/Evarentha/linearpress-shuoshuo
