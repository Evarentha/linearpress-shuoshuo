# Shuoshuo

[![LinearPress](https://img.shields.io/badge/LinearPress-plugin-7C3AED.svg)](https://www.npmjs.com/package/@evarentha/linearpress) [![npm](https://img.shields.io/npm/v/@evarentha/linearpress-shuoshuo.svg)](https://www.npmjs.com/package/@evarentha/linearpress-shuoshuo) [![Node.js](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org) [![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)

**English** | [简体中文](README.zh-CN.md)

A microblog-style post type for LinearPress. A shuoshuo has no title and exactly one paragraph; the home list shows the full text as a card, and there is no reading page: opening a permalink returns 404 by design. Requires JavaScript in the browser for the editor.

## Install

```bash
git clone https://github.com/Evarentha/linearpress-shuoshuo.git src/plugins/shuoshuo
```

The directory name must equal the plugin id. Restart afterwards, or sync from the `base` checkout (`sh scripts/sync-plugins.sh shuoshuo`), or upload the ZIP / npm name from the admin Plugins page. There is nothing to configure: no settings page, no config keys. Every save picks a status directly, draft, published, or archived.

The admin pages sit behind the base post permissions: the list and editing an existing shuoshuo need `post:edit`, creating needs `post:create`, deleting needs `post:delete`. The list lives at `/admin/shuoshuo` with its own admin menu entry. Note that this plugin's override of the admin posts list only applies while advanced-posts-list is absent: that plugin registers the same route, and its list does not tag shuoshuo rows.

## Writing one

The editor is a single contenteditable paragraph. Enter inserts a line break instead of a new paragraph, and pasted block containers are stripped so the content stays one paragraph. Selecting text brings up a floating bar with bold, italic, underline, strikethrough, font size up and down, and text and background colors; legacy `font` tags are normalized to `span`s. A local draft autosaves to localStorage every 30 seconds, a restore prompt appears when it is newer than the saved version, and the editor warns before you leave with unsaved changes.

Content is sanitized twice, on save and again on render. Only the inline tags `strong`, `b`, `em`, `i`, `u`, `s`, `del`, `span`, `br`, `code`, and `mark` survive (`font` converts to `span`), every attribute is dropped except a whitelisted set of style properties, and scripts and comments are removed, which blocks stored XSS.

## Storage

No new tables, no migrations. A shuoshuo is a row in the core `posts` table with an empty title, a slug of the form `reserved_shuoshuo_<UUID>`, and a single paragraph block in `content_json`, the same structure modern-editor reads and writes. `LP-MODERN-BLOCK::` marker blocks are decoded and re-sanitized, so a shuoshuo opens in either editor. Disable the plugin and normal posts keep working; only the reserved prefix protection stops applying.

A `post:beforeSave` hook empties the slug of any normal post that would collide with the reserved prefix, letting the system regenerate it from the title, and a 404 middleware runs before the core routes matching the prefix in any permalink form, leaving admin, API, and plugin asset paths untouched.

## For themes

`isShuoShuo(slug)` and `shuoshuoHtml(post)` arrive through `site:locals` on every request, so any theme can feature-detect shuoshuo and render full-text cards; fluentui-theme (the theme plugin, linearpress-theme-fluent) does this already. The plugin overrides the home list and the admin posts list, and when a theme overrides the same view the winner is decided by plugin load order on the admin Plugins page.

## License

GPL-3.0-or-later, Copyright (C) 2026 Evarentha. See LICENSE.
