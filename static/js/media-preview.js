/* Decorative media selection only. Native links own routing and filtering. */
(() => {
  'use strict';

  function create(root) {
    if (root.mediaPreview) return root.mediaPreview;
    const board = root.querySelector('[data-media-board]');
    const links = [...root.querySelectorAll('[data-media-kind]')];
    const buttons = [...root.querySelectorAll('[data-preview-kind]')];
    const targets = [...links, ...buttons];
    const art = [...root.querySelectorAll('[data-preview-art]')];
    const notes = [...root.querySelectorAll('[data-preview-note]')];
    const initial = root.dataset.activeKind;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const cleanups = [];
    let focusKind = null, pointerKind = null, previewKind = null;
    let pointer = null, frame = 0, near = true, disposed = false;

    function on(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      cleanups.push(() => target.removeEventListener(event, handler, options));
    }
    function select() {
      const active = focusKind || pointerKind || previewKind || initial;
      root.dataset.activeKind = active;
      art.forEach(image => image.classList.toggle('is-active', image.dataset.previewArt === active));
      notes.forEach(note => { note.hidden = note.dataset.previewNote !== active; });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.previewKind === previewKind)));
    }
    function clearPointer() {
      pointer = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      board.removeAttribute('data-pointer-inside');
      board.style.removeProperty('--pointer-x');
      board.style.removeProperty('--pointer-y');
    }
    function update() {
      frame = 0;
      if (!pointer || !near || document.hidden || reduced.matches || !fine.matches || disposed) return;
      const rect = board.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, pointer.x - rect.left));
      const y = Math.max(0, Math.min(rect.height, pointer.y - rect.top));
      board.style.setProperty('--pointer-x', `${x.toFixed(1)}px`);
      board.style.setProperty('--pointer-y', `${y.toFixed(1)}px`);
      board.dataset.pointerInside = 'true';
    }
    function schedule() {
      if (pointer && !frame && near && !document.hidden && !reduced.matches && fine.matches) frame = requestAnimationFrame(update);
    }
    links.forEach(link => on(link, 'pointerenter', event => {
      if (!fine.matches || event.pointerType === 'touch') return;
      pointerKind = link.dataset.mediaKind;
      select();
    }));
    targets.forEach(target => {
      on(target, 'focus', () => { focusKind = target.dataset.mediaKind || target.dataset.previewKind; select(); });
      on(target, 'blur', () => queueMicrotask(() => {
        if (disposed) return;
        const active = document.activeElement;
        focusKind = targets.includes(active) ? active.dataset.mediaKind || active.dataset.previewKind : null;
        select();
      }));
    });
    buttons.forEach(button => {
      button.hidden = false;
      on(button, 'click', () => { previewKind = button.dataset.previewKind; select(); });
    });
    on(board, 'pointermove', event => {
      if (!near || !fine.matches || reduced.matches || event.pointerType === 'touch') return;
      pointer = {x: event.clientX, y: event.clientY};
      schedule();
    }, {passive:true});
    on(board, 'pointerleave', clearPointer, {passive:true});
    on(root, 'pointerleave', () => { pointerKind = null; clearPointer(); select(); }, {passive:true});
    on(window, 'resize', schedule, {passive:true});
    on(fine, 'change', () => { pointerKind = null; clearPointer(); select(); });
    on(reduced, 'change', clearPointer);
    on(document, 'visibilitychange', () => {
      root.toggleAttribute('data-media-paused', document.hidden || !near);
      if (document.hidden) { pointerKind = null; clearPointer(); select(); }
    });
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      near = entries[0].isIntersecting;
      root.toggleAttribute('data-media-paused', !near || document.hidden);
      if (!near) { pointerKind = null; clearPointer(); select(); }
    }) : null;
    if (observer) observer.observe(board);
    on(window, 'pagehide', event => {
      clearPointer();
      root.setAttribute('data-media-paused', '');
      if (!event.persisted) root.mediaPreview.destroy();
    });
    on(window, 'pageshow', () => root.toggleAttribute('data-media-paused', !near || document.hidden));

    root.mediaPreview = {
      destroy() {
        if (disposed) return;
        disposed = true;
        clearPointer();
        if (observer) observer.disconnect();
        cleanups.forEach(off => off());
        focusKind = pointerKind = previewKind = null;
        select();
        buttons.forEach(button => { button.hidden = true; });
        root.removeAttribute('data-media-paused');
        delete root.mediaPreview;
      },
      getState: () => ({active:root.dataset.activeKind, pendingFrame:!!frame, near, reduced:reduced.matches})
    };
    return root.mediaPreview;
  }
  window.XYMediaPreview = Object.freeze({create});
  document.querySelectorAll('[data-media-discovery]').forEach(create);
})();
