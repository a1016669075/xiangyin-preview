// Adapted from codex/实验-地图模块, suite 06. The site owns requests and navigation.
const host = document.querySelector('[data-map-field]');
if (host) {
  const map = host.querySelector('.region-map-surface');
  const mapSvg = map.querySelector('.province-map');
  const panel = host.querySelector('#region-panel');
  const shell = host.closest('[data-region-explorer]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let reduceActive = reduced.matches;
  const state = {progress: 1, panelProgress: 1, mapMode: null, origin: {x: .48, y: .56}};
  const timings = {intro: 2400, ripple: 2200, trace: 1200, panel: 2200};
  const animations = new Set();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('map-motion-connection');
  svg.setAttribute('aria-hidden', 'true');
  host.append(svg);
  let engine, loading, failed = false, visible = true, raf = 0, last = 0;
  let mapElapsed = timings.intro, mapDuration = timings.intro, panelElapsed = timings.panel;
  let clickOrigin = null;

  function clearTrace() {
    animations.forEach(a => a.cancel());
    animations.clear();
    svg.replaceChildren();
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }
  function settle() {
    stop();
    clearTrace();
    state.progress = state.panelProgress = 1;
    mapElapsed = mapDuration;
    panelElapsed = timings.panel;
    engine?.clear();
  }
  function enabled() {
    return engine && !failed && !reduceActive && visible && !document.hidden;
  }
  function wake() {
    if (!enabled() || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    if (!enabled()) return;
    const dt = Math.min(now - last, 50);
    last = now;
    mapElapsed += dt;
    panelElapsed += dt;
    state.progress = Math.min(1, mapElapsed / mapDuration);
    state.panelProgress = Math.min(1, panelElapsed / timings.panel);
    engine.render(state);
    if (state.progress < 1 || state.panelProgress < 1) {
      raf = requestAnimationFrame(frame);
    } else engine.clear();
  }
  function pointFor(slug) {
    if (clickOrigin?.region === slug) return clickOrigin.point.matrixTransform(mapSvg.getScreenCTM());
    const link = [...map.querySelectorAll('.region-map-province')].find(n => n.dataset.region === slug);
    if (!link) return null;
    // Use the geographic label anchor, not the bounding box of scattered islands.
    return new DOMPoint(Number(link.dataset.mapX), Number(link.dataset.mapY))
      .matrixTransform(mapSvg.getScreenCTM());
  }
  function connection(point) {
    clearTrace();
    if (panel.hidden || innerWidth < 1200) return;
    const h = host.getBoundingClientRect(), target = panel.querySelector('#panel-title').getBoundingClientRect();
    const x = point.x - h.left, y = point.y - h.top;
    const tx = target.left - h.left - 10, ty = target.top + target.height / 2 - h.top;
    svg.setAttribute('viewBox', `0 0 ${h.width} ${h.height}`);
    const bend = Math.max(50, (tx - x) * .45);
    for (const cls of ['trace-halo', 'trace-line']) {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.classList.add(cls);
      path.setAttribute('d', `M${x},${y} C${x + bend},${y - 32} ${tx - 90},${ty} ${tx},${ty}`);
      svg.append(path);
      const length = path.getTotalLength(), opacity = cls === 'trace-halo' ? .18 : .65;
      path.style.strokeDasharray = length;
      const a = path.animate([
        {strokeDashoffset: length, opacity: 0},
        {strokeDashoffset: length, opacity, offset: .07},
        {strokeDashoffset: 0, opacity, offset: .67},
        {strokeDashoffset: -length, opacity: 0}
      ], {duration: timings.trace, easing: 'cubic-bezier(.2,.7,.2,1)'});
      animations.add(a);
      const done = () => { animations.delete(a); path.remove(); };
      a.finished.then(done, done);
    }
  }
  function resize() {
    if (!engine || failed) return;
    engine.resize();
    clearTrace();
    if (enabled()) engine.render(state);
  }
  async function initialize() {
    if (engine || loading || failed || reduceActive || !visible || document.hidden) return;
    loading = true;
    try {
      const {MapField} = await import(host.dataset.mapField);
      if (reduceActive || !visible || document.hidden) return;
      engine = new MapField(host, map, panel);
      engine.canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        settle();
        failed = true;
        engine.canvas.hidden = true;
        shell.classList.remove('map-motion-ready');
      });
      shell.classList.add('map-motion-ready');
      let seen = false;
      try {
        seen = sessionStorage.getItem('xy-map-entry') === '1';
        sessionStorage.setItem('xy-map-entry', '1');
      } catch { /* Browsing and selection do not depend on storage. */ }
      const navigation = performance.getEntriesByType('navigation')[0];
      if (!seen && !location.hash && navigation?.type !== 'back_forward') {
        state.mapMode = 0;
        state.progress = 0;
        mapElapsed = 0;
        engine.render(state);
        wake();
      }
    } catch (error) {
      failed = true;
      engine?.dispose();
      host.querySelector('.map-motion-canvas')?.remove();
      shell.classList.remove('map-motion-ready');
      console.warn('Map animation unavailable; native province navigation remains active.', error);
    } finally { loading = false; }
  }
  host.addEventListener('click', event => {
    const choice = event.target.closest('[data-region]');
    if (!choice || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    clickOrigin = map.contains(choice) && event.detail > 0
      ? {region: choice.dataset.region, point: new DOMPoint(event.clientX, event.clientY).matrixTransform(mapSvg.getScreenCTM().inverse())}
      : null;
  }, {capture: true});
  // Reading or selecting immediately ends any covering animation.
  host.addEventListener('pointerdown', settle, {passive: true});
  host.addEventListener('focusin', settle);
  panel.querySelector('.panel-body').addEventListener('wheel', settle, {passive: true});
  shell.addEventListener('xiangyin:regionchange', event => {
    if (!enabled()) return;
    settle();
    engine.resize();
    const point = pointFor(event.detail.region);
    clickOrigin = null;
    if (point) {
      const b = map.getBoundingClientRect();
      state.origin = {x: (point.x - b.left) / b.width, y: 1 - (point.y - b.top) / b.height};
      state.mapMode = 3;
      state.progress = mapElapsed = 0;
      mapDuration = timings.ripple;
      connection(point);
    }
    state.panelProgress = panelElapsed = 0;
    engine.render(state);
    wake();
  });
  const size = new ResizeObserver(resize);
  [host, map, panel, panel.querySelector('.panel-body')].forEach(node => size.observe(node));
  const visibility = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) settle();
    else { initialize(); resize(); }
  });
  visibility.observe(host);
  reduced.addEventListener('change', event => {
    reduceActive = event.matches;
    settle();
    if (reduceActive) shell.classList.remove('map-motion-ready');
    else if (engine && !failed) shell.classList.add('map-motion-ready');
    else initialize();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) settle();
    else initialize();
  });
  window.addEventListener('pagehide', settle);
  window.addEventListener('pageshow', event => { if (event.persisted) { settle(); resize(); } });
  initialize();
}
