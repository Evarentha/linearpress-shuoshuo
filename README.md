# Shuoshuo

[![LinearPress](https://img.shields.io/badge/LinearPress-plugin-7C3AED.svg)](https://www.npmjs.com/package/@evarentha/linearpress) [![npm](https://img.shields.io/npm/v/@evarentha/linearpress-shuoshuo.svg)](https://www.npmjs.com/package/@evarentha/linearpress-shuoshuo) [![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)

**English** | [简体中文](README.zh-CN.md)

Short posts (“说说”) for LinearPress.

## Features

- One paragraph, no title; bold, highlight and links.
- A timeline at /shuoshuo and the latest few on the home page.
- Stored as their own content type, so they never mix into the post lists.

## Where to find it

- `/admin/shuoshuo`: write and manage short posts

## Install

Bundled with LinearPress 4. Enable or disable it on the admin Plugins page; the change applies immediately, no restart. In another checkout, run `npm run sync -- shuoshuo` from LinearPress, or put this repository at `src/plugins/shuoshuo` (the directory name must equal the plugin id).

Requires LinearPress ^4.0.0. Works on SQLite and MySQL.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).

Source: https://github.com/Evarentha/linearpress-shuoshuo
