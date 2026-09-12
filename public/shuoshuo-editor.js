/*
 * Shuoshuo Editor Frontend Runtime
 *
 * Browser runtime for the single-paragraph shuoshuo editor, with an inline
 * format toolbar consistent with modern-editor.
 *
 * Authors:
 * MoyuZJ <moyuzj@moyuzj.cn> @LinearTeam - Made in China with ♥
 *
 * Copyright (C) 2026 Evarentha
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Shuoshuo editor: single-paragraph rich text (contenteditable) with an
 * inline format toolbar whose interactions match modern-editor. Activates
 * only on pages where [data-shuoshuo-editor] is present.
 * @since 1.0.0
 */

(() => {
  const page = document.querySelector('[data-shuoshuo-editor]');
  if (!page) return;

  const form = page.querySelector('#shuoshuo-form');
  const editable = page.querySelector('[data-shuoshuo-editable]');
  const output = page.querySelector('#shuoshuo-content-json');
  const status = page.querySelector('[data-shuoshuo-status]');
  const saveStatus = page.querySelector('[data-shuoshuo-save-status]');
  const postId = page.querySelector('input[name="id"]')?.value || '';
  const isNew = !postId;
  const storageKey = `linearpress:shuoshuo:${postId || 'new'}`;

  let savedSelection = null;
  let dirty = false;

  // ------------------------------------------------------------ 初始内容
  const initial = String(window.SHUOSHUO_INITIAL || '');
  if (initial) editable.innerHTML = initial;
  else if (localStorage.getItem(storageKey)) {
    try {
      const local = JSON.parse(localStorage.getItem(storageKey));
      if (local.html && local.at > Number(page.dataset.cloudSavedAt || 0) && confirm('发现一份更新的本地草稿，是否恢复？')) editable.innerHTML = local.html;
      else localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }

  function sync() { output.value = JSON.stringify([{ type: 'paragraph', contentHtml: editable.innerHTML }]); }
  function textOf(root) { return (root.innerText || '').trim(); }
  function markDirty() { dirty = true; saveStatus.textContent = '有未保存修改'; sync(); }
  editable.addEventListener('input', markDirty);

  // ------------------------------------------------------------ 单段落约束
  editable.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.execCommand('insertLineBreak', false, null); // 段内换行，不产生新段落
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertText', false, '    ');
    }
  });
  editable.addEventListener('paste', () => {
    // 粘贴后立即做一次轻量清理：剥掉块级容器标签，保持单段落。
    setTimeout(() => {
      editable.querySelectorAll('div,section,article,h1,h2,h3,h4,p').forEach((el) => {
        el.replaceWith(...Array.from(el.childNodes));
      });
      markDirty();
    }, 0);
  });

  // ------------------------------------------------------------ 浮动格式工具栏
  const formatBar = document.createElement('div');
  formatBar.className = 'shuoshuo-format-bar';
  formatBar.setAttribute('role', 'toolbar');
  formatBar.innerHTML = '<button type="button" data-cmd="bold" title="加粗"><b>B</b></button>'
    + '<button type="button" data-cmd="italic" title="斜体"><i>I</i></button>'
    + '<button type="button" data-cmd="underline" title="下划线"><u>U</u></button>'
    + '<button type="button" data-cmd="strikeThrough" title="删除线"><s>S</s></button>'
    + '<button type="button" data-cmd="fontSmaller" title="字号-">A−</button>'
    + '<button type="button" data-cmd="fontLarger" title="字号+">A+</button>'
    + '<label title="文字颜色">A<input type="color" data-color="foreColor" value="#17201c"></label>'
    + '<label title="背景颜色">▰<input type="color" data-color="backColor" value="#fff2a8"></label>';
  document.body.append(formatBar);

  function editableSelection() {
    const selection = window.getSelection();
    return selection && selection.rangeCount && selection.anchorNode && page.contains(selection.anchorNode) ? selection : null;
  }
  function positionFormatBar() {
    if (!savedSelection) return;
    const rect = savedSelection.getBoundingClientRect();
    const width = formatBar.offsetWidth;
    const height = formatBar.offsetHeight;
    formatBar.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))}px`;
    let top = rect.top - height - 10;
    if (top < 8) top = rect.bottom + 10;
    if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
    formatBar.style.top = `${top}px`;
  }
  const showBar = (selection) => {
    if (!selection || selection.isCollapsed) { formatBar.classList.remove('is-visible'); return false; }
    const parent = selection.anchorNode?.parentElement?.closest('[contenteditable="true"]');
    if (!parent || parent !== editable) { formatBar.classList.remove('is-visible'); return false; }
    savedSelection = selection.getRangeAt(0).cloneRange();
    formatBar.classList.add('is-visible');
    requestAnimationFrame(positionFormatBar);
    return true;
  };
  document.addEventListener('selectionchange', () => {
    const selection = editableSelection();
    if (formatBar.contains(document.activeElement)) return;
    if (!selection || selection.isCollapsed) { formatBar.classList.remove('is-visible'); return; }
    showBar(selection);
  });
  window.addEventListener('resize', positionFormatBar);
  window.addEventListener('scroll', positionFormatBar, true);
  formatBar.addEventListener('mousedown', (event) => { if (event.target instanceof Element && event.target.closest('button')) event.preventDefault(); });

  const SIZE_MAP = { '1': '10px', '2': '12px', '3': '14px', '4': '16px', '5': '18px', '6': '24px', '7': '32px' };
  function normalizeInlineMarkup(root) {
    root.querySelectorAll('font[color],font[size],font[style]').forEach((font) => {
      const span = document.createElement('span');
      if (font.getAttribute('color')) span.style.color = font.getAttribute('color');
      if (font.getAttribute('size')) span.style.fontSize = SIZE_MAP[font.getAttribute('size')] || '16px';
      if (font.getAttribute('style')) span.setAttribute('style', font.getAttribute('style'));
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  }
  function applyRelativeFontSize(delta) {
    if (!savedSelection) return;
    const start = savedSelection.startContainer.nodeType === Node.ELEMENT_NODE ? savedSelection.startContainer : savedSelection.startContainer.parentElement;
    const current = start ? parseFloat(getComputedStyle(start).fontSize) || 16 : 16;
    const next = Math.max(10, Math.min(48, current + delta));
    const fragment = savedSelection.extractContents();
    fragment.querySelectorAll('[style]').forEach((el) => el.style.removeProperty('font-size'));
    fragment.querySelectorAll('font[size]').forEach((el) => el.removeAttribute('size'));
    const span = document.createElement('span');
    span.style.fontSize = `${next}px`;
    span.append(fragment);
    savedSelection.insertNode(span);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(span);
    selection.removeAllRanges(); selection.addRange(range);
    savedSelection = range.cloneRange();
  }
  function applyFormat(command, value) {
    if (!savedSelection) return;
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(savedSelection);
    if (command === 'fontSmaller') applyRelativeFontSize(-2);
    else if (command === 'fontLarger') applyRelativeFontSize(2);
    else if (command === 'backColor' && !document.execCommand(command, false, value)) document.execCommand('hiliteColor', false, value);
    else document.execCommand(command, false, value);
    normalizeInlineMarkup(editable);
    editable.dispatchEvent(new Event('input', { bubbles: true }));
    formatBar.classList.add('is-visible');
    requestAnimationFrame(positionFormatBar);
  }
  formatBar.querySelectorAll('[data-cmd]').forEach((button) => button.addEventListener('click', () => applyFormat(button.dataset.cmd)));
  formatBar.querySelectorAll('[data-color]').forEach((input) => input.addEventListener('input', () => applyFormat(input.dataset.color, input.value)));

  // ------------------------------------------------------------ 保存
  function submit(nextStatus) {
    if (!textOf(editable)) {
      if (!confirm('说说内容为空，仍然保存吗？')) return;
    }
    status.value = nextStatus;
    sync();
    dirty = false;
    localStorage.removeItem(storageKey);
    form.submit();
  }
  page.querySelector('[data-shuoshuo-draft]').addEventListener('click', () => submit('draft'));
  page.querySelector('[data-shuoshuo-publish]').addEventListener('click', () => submit('published'));

  setInterval(() => {
    if (dirty) { sync(); localStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), html: editable.innerHTML })); saveStatus.textContent = '已保存到本地'; }
  }, 30000);
  window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
})();