/*
 * Shuoshuo Composer
 *
 * Single-paragraph rich text input on the admin page: inline formats, character count, local draft.
 *
 * Authors:
 * MoyuZJ <moyuzj@evarentha.com> @LinearTeam - Made in China with ♥
 * worryzu <worryzu@evarentha.com> @LinearTeam
 *
 * Copyright (C) 2026 Evarentha
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
(() => {
  const form = document.querySelector('[data-ss-composer]');
  if (!form) return;
  const LP = window.LinearPress;
  const editable = form.querySelector('[data-ss-editable]');
  const hidden = form.querySelector('[data-ss-html]');
  const counter = form.querySelector('[data-ss-count]');
  const max = Number(counter.dataset.max) || 2000;
  const id = form.querySelector('input[name=id]').value;
  const key = `linearpress:shuoshuo:${id || 'new'}`;
  const textOf = () => editable.innerText.replace(/ /g, ' ').trim();

  const update = () => {
    const length = [...textOf()].length;
    counter.textContent = `${length} / ${max}`;
    counter.classList.toggle('is-over', length > max);
    hidden.value = editable.innerHTML;
  };
  const remember = () => { try { if (textOf()) localStorage.setItem(key, editable.innerHTML); else localStorage.removeItem(key); } catch { /* storage unavailable */ } };

  // Restore an unsent draft only into an empty composer (never over server content or a failed submission).
  try {
    const saved = localStorage.getItem(key);
    if (saved && !editable.textContent.trim()) {
      editable.innerHTML = saved;
      LP?.toast('已恢复上次没有发出的内容');
    }
  } catch { /* storage unavailable */ }

  editable.addEventListener('input', () => { update(); remember(); hidden.dispatchEvent(new Event('input', { bubbles: true })); });
  editable.addEventListener('keydown', (event) => {
    // One paragraph: Enter inserts a line break inside it. Ctrl/Cmd+Enter publishes.
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.querySelector('button[value=publish]').click(); return; }
    if (event.key === 'Enter') { event.preventDefault(); document.execCommand('insertLineBreak'); }
  });
  editable.addEventListener('paste', (event) => {
    // Paste as plain text; formatting is applied with the toolbar.
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  });

  form.querySelector('.ss-toolbar').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-cmd]');
    if (!button) return;
    editable.focus();
    const cmd = button.dataset.cmd;
    if (cmd === 'mark') {
      // <mark> rather than an inline colour, so the theme decides how highlights look (light and dark).
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) { LP?.toast('先选中要高亮的文字', 'danger'); return; }
      const range = selection.getRangeAt(0);
      const existing = range.commonAncestorContainer.parentElement?.closest('mark');
      if (existing && editable.contains(existing)) existing.replaceWith(...existing.childNodes);
      else { try { range.surroundContents(document.createElement('mark')); } catch { const mark = document.createElement('mark'); mark.textContent = range.toString(); range.deleteContents(); range.insertNode(mark); } }
    }
    else if (cmd === 'clear') { document.execCommand('removeFormat'); document.execCommand('unlink'); }
    else if (cmd === 'link') {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) { LP?.toast('先选中要加链接的文字', 'danger'); return; }
      const range = selection.getRangeAt(0);
      const url = window.prompt('链接地址（http:// 或 https:// 开头）', 'https://');
      if (!url || !/^(https?:\/\/|mailto:)/i.test(url.trim())) { if (url) LP?.toast('链接需要以 http:// 或 https:// 开头', 'danger'); return; }
      selection.removeAllRanges(); selection.addRange(range);
      document.execCommand('createLink', false, url.trim());
    } else document.execCommand(cmd);
    update(); remember();
  });

  form.addEventListener('submit', (event) => {
    update();
    if (!textOf()) { event.preventDefault(); LP?.toast('写点什么再发布吧', 'danger'); editable.focus(); return; }
    if ([...textOf()].length > max) { event.preventDefault(); LP?.toast(`说说最多 ${max} 字`, 'danger'); return; }
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
  });
  update();
  if (id || form.classList.contains('has-error')) { editable.focus(); const range = document.createRange(); range.selectNodeContents(editable); range.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
})();
