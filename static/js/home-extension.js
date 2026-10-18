(() => {
  const rail = document.querySelector('#home-picks-rail');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (rail) {
    const controls = document.querySelector('.home-rail-controls');
    const previous = controls.querySelector('[data-rail-direction="-1"]');
    const next = controls.querySelector('[data-rail-direction="1"]');
    const update = () => {
      previous.disabled = rail.scrollLeft <= 1;
      next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
      controls.hidden = rail.scrollWidth <= rail.clientWidth + 2;
    };
    controls.addEventListener('click', event => {
      const button = event.target.closest('[data-rail-direction]');
      if (!button) return;
      const step = rail.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).gap);
      rail.scrollBy({left: Number(button.dataset.railDirection) * step, behavior: reduced.matches ? 'auto' : 'smooth'});
    });
    rail.addEventListener('scroll', update, {passive: true});
    window.addEventListener('resize', update);
    update();
  }

  // Content is visible by default. This observer only adds a one-time transition.
  const pending = new Set();
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (reduced.matches || document.hidden || typeof entry.target.animate !== 'function') continue;
        const style = getComputedStyle(entry.target);
        const animation = entry.target.animate([
          {opacity: 0, transform: `translateY(${style.getPropertyValue('--home-enter-y').trim()})`},
          {opacity: 1, transform: 'translateY(0)'}
        ], {duration: parseFloat(style.getPropertyValue('--home-enter-duration')), easing: style.getPropertyValue('--motion-ease').trim()});
        pending.add(animation);
        animation.finished.catch(() => {}).finally(() => pending.delete(animation));
      }
    }, {threshold: 0.12});
    document.querySelectorAll('[data-home-reveal]').forEach(node => observer.observe(node));
    const finish = () => { for (const animation of pending) animation.cancel(); pending.clear(); };
    reduced.addEventListener('change', () => { if (reduced.matches) { observer.disconnect(); finish(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  }
  document.querySelector('[data-comment-errors]')?.focus({preventScroll: true});
})();
