/* Decorative F effects only: routing, data and reading remain server-rendered. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Map();
  const headings = [...document.querySelectorAll('.workspace-heading, .panel-header, .page-heading, .article-heading')];
  const beams = new Map();
  const enabled = () => !reduced.matches && !document.hidden && typeof Element.prototype.animate === 'function';

  function play(node, frames, duration) {
    animations.get(node)?.cancel();
    if (!enabled()) return;
    const animation = node.animate(frames, {duration, easing: 'cubic-bezier(.2,.7,.2,1)'});
    animations.set(node, animation);
    const finish = () => {
      if (animations.get(node) === animation) animations.delete(node);
      animation.cancel();
    };
    animation.finished.then(finish, finish);
  }
  function sweep(heading) {
    const beam = beams.get(heading);
    if (!beam || !heading.getClientRects().length) return;
    play(beam, [
      {transform: 'translateX(0) skewX(-25deg)', opacity: 0},
      {transform: 'translateX(72%) skewX(-25deg)', opacity: 1, offset: .2},
      {transform: 'translateX(360%) skewX(-25deg)', opacity: 0}
    ], 650);
  }
  headings.forEach(heading => {
    const lens = document.createElement('span');
    lens.className = 'prism-lens';
    lens.setAttribute('aria-hidden', 'true');
    const beam = document.createElement('span');
    lens.append(beam);
    heading.append(lens);
    heading.classList.add('prism-heading');
    beams.set(heading, beam);
  });

  const navigation = performance.getEntriesByType('navigation')[0];
  if (!location.hash && (!navigation || navigation.type === 'navigate')) {
    headings.forEach(sweep);
    const article = document.querySelector('.article-heading');
    if (article) play(article, [{opacity: .72, transform: 'translateY(6px)'}, {opacity: 1, transform: 'translateY(0)'}], 400);
  }
  const explorer = document.querySelector('[data-region-explorer]');
  explorer?.addEventListener('xiangyin:regionchange', () => {
    sweep(explorer.querySelector('.workspace-heading'));
    sweep(explorer.querySelector('.panel-header'));
  });
  function stop() {
    animations.forEach(animation => animation.cancel());
    animations.clear();
  }
  reduced.addEventListener('change', () => { if (reduced.matches) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
