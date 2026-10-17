/* M01: the sidebar brand enters once; document content is never animated. */
(() => {
  const brand = document.querySelector('.site-sidebar .brand');
  if (!brand || brand.dataset.brandReveal) return;
  brand.dataset.brandReveal = 'complete';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const navigation = performance.getEntriesByType('navigation')[0];
  let seen = false;
  try {
    const key = 'xiangyin.sidebar-brand.v1';
    seen = !!sessionStorage.getItem(key);
    sessionStorage.setItem(key, 'seen');
  } catch (_) { /* If storage is unavailable, at most one entry per page load. */ }
  if (seen || reduced.matches || document.hidden || !brand.animate || (navigation && navigation.type !== 'navigate')) return;
  const style = getComputedStyle(brand);
  const events = new AbortController();
  const animation = brand.animate([
    {opacity: 0, transform: `translateY(${style.getPropertyValue('--m01-y').trim()})`},
    {opacity: 1, transform: 'translateY(0)'}
  ], {duration: parseFloat(style.getPropertyValue('--m01-duration')),
    easing: style.getPropertyValue('--motion-ease').trim(), fill: 'backwards'});
  brand.dataset.brandReveal = 'playing';
  function finish() {
    animation.cancel();
    brand.dataset.brandReveal = 'complete';
    events.abort();
  }
  reduced.addEventListener('change', finish, {signal: events.signal});
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); }, {signal: events.signal});
  window.addEventListener('pagehide', finish, {signal: events.signal});
  animation.finished.then(finish, finish);
})();

/* M04: reading bookmark */
/* Reading enhancement is local to real, complete multi-question interviews. */
(() => {
  const reading = document.querySelector('[data-reading-motion]');
  if (!reading) return;
  reading.destroyReadingMotion?.();
  const sections = [...reading.querySelectorAll('.qa-item')];
  if (sections.length < 2 || !('IntersectionObserver' in window)) return;
  const headings = sections.map(section => section.querySelector('h2'));
  const directories = [...reading.querySelectorAll('.question-directory nav, .mobile-question-directory nav')];
  const mobileDirectory = reading.querySelector('.mobile-question-directory');
  const currentLabel = reading.querySelector('[data-reading-current]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const listen = (target, name, callback, options = {}) => target.addEventListener(name, callback, {...options, signal: events.signal});
  let current = -1, scrollFrame = 0, positionFrame = 0, operation = 0, locating = null;
  let locatedY = null;
  let highlightTimer = 0, highlighted = null, initialAnchorPending = true;

  headings.forEach(heading => heading.tabIndex = -1);
  const bookmarks = directories.map(nav => {
    const marker = document.createElement('span');
    marker.className = 'reading-bookmark';
    marker.setAttribute('aria-hidden', 'true');
    nav.append(marker);
    return {nav, marker, links: [...nav.querySelectorAll('a')]};
  });

  function measureBookmarks() {
    const measurements = bookmarks.map(({nav, marker, links}) => {
      if (current < 0 || !nav.getClientRects().length) return null;
      const bounds = links[current].getBoundingClientRect();
      if (!bounds.height) return null;
      const navBounds = nav.getBoundingClientRect();
      const scale = navBounds.width / nav.offsetWidth;
      return {marker, x:(bounds.left - navBounds.left) / scale, y:(bounds.top - navBounds.top) / scale,
        width:bounds.width / scale, height:bounds.height / scale};
    });
    measurements.forEach(size => {
      if (!size) return;
      size.marker.style.transform = `translate(${size.x}px,${size.y}px)`;
      size.marker.style.width = `${size.width}px`;
      size.marker.style.height = `${size.height}px`;
    });
  }
  function select(index) {
    if (current !== index) {
      current = index;
      bookmarks.forEach(({links}) => links.forEach((link, at) => {
        if (at === index) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }));
      sections.forEach((section, at) => section.classList.toggle('reading-current-question', at === index));
      currentLabel.hidden = false;
      currentLabel.textContent = `当前第 ${index + 1} 题`;
    }
    measureBookmarks();
  }
  function headerOffset() {
    const bounds = reading.getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    return [...document.querySelectorAll('.site-header, .site-sidebar')].reduce((offset, header) => {
      const position = getComputedStyle(header).position;
      const rect = header.getBoundingClientRect();
      // A fixed left sidebar does not cover the article's top anchor.
      return (position === 'fixed' || position === 'sticky') && rect.top <= 0 && rect.left < center && rect.right > center
        ? Math.max(offset, rect.bottom + 16) : offset;
    }, 24);
  }
  function updatePosition() {
    positionFrame = 0;
    if (locating) return;
    if (locatedY !== null && Math.abs(scrollY - locatedY) < 2) { measureBookmarks(); return; }
    locatedY = null;
    const reference = Math.max(headerOffset(), innerHeight * .28);
    let index = 0;
    headings.forEach((heading, at) => { if (heading.getBoundingClientRect().top <= reference) index = at; });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) index = sections.length - 1;
    select(index);
  }
  function queuePosition() {
    if (!document.hidden && !events.signal.aborted && !positionFrame) positionFrame = requestAnimationFrame(updatePosition);
  }
  function clearHighlight() {
    clearTimeout(highlightTimer);
    if (highlighted) highlighted.classList.remove('reading-highlight');
    highlighted = null;
  }
  function duration(token) {
    return parseFloat(getComputedStyle(reading).getPropertyValue(token));
  }
  function cancelLocation() {
    operation++;
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    locating = null;
    locatedY = null;
    clearHighlight();
  }
  function destination(index) {
    const top = scrollY + headings[index].getBoundingClientRect().top - headerOffset();
    return Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
  }
  function finishLocation(id, index, focus) {
    if (id !== operation) return;
    locating = null;
    scrollFrame = 0;
    locatedY = scrollY;
    select(index);
    if (focus) {
      headings[index].focus({preventScroll: true});
      if (!reduced.matches) {
        highlighted = headings[index];
        highlighted.classList.add('reading-highlight');
        highlightTimer = setTimeout(clearHighlight, duration('--m04-heading-duration'));
      }
    }
  }
  function locate(index, {animate = false, focus = false} = {}) {
    cancelLocation();
    const id = operation;
    locating = {index, focus};
    select(index);
    // Closing details changes the article's geometry; measure on the next frame.
    scrollFrame = requestAnimationFrame(() => {
      if (id !== operation) return;
      const start = scrollY, end = destination(index);
      const travelDuration = animate && !reduced.matches ? duration('--m04-tag-duration') : 0;
      if (!travelDuration || Math.abs(end - start) < 2) {
        window.scrollTo({top: end, behavior: 'instant'});
        finishLocation(id, index, focus);
        return;
      }
      const started = performance.now();
      function step(now) {
        if (id !== operation) return;
        const progress = Math.min(1, (now - started) / travelDuration);
        window.scrollTo({top: start + (end - start) * (1 - Math.pow(1 - progress, 3)), behavior: 'instant'});
        if (progress < 1) scrollFrame = requestAnimationFrame(step);
        else finishLocation(id, index, focus);
      }
      scrollFrame = requestAnimationFrame(step);
    });
  }
  directories.forEach(nav => listen(nav, 'click', event => {
    const link = event.target.closest('a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const index = sections.findIndex(section => '#' + section.id === link.hash);
    if (index < 0) return;
    event.preventDefault();
    initialAnchorPending = false;
    mobileDirectory.open = false;
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    locate(index, {animate: true, focus: true});
  }));
  function interrupt() {
    initialAnchorPending = false;
    cancelLocation();
    queuePosition();
  }
  listen(window, 'wheel', interrupt, {passive: true});
  listen(window, 'touchstart', interrupt, {passive: true});
  listen(window, 'pointerdown', interrupt, {passive: true});
  listen(window, 'keydown', event => {
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Tab'].includes(event.key)) interrupt();
  });
  function hashLocation() {
    const index = sections.findIndex(section => '#' + section.id === location.hash);
    if (index >= 0) locate(index);
    else { cancelLocation(); queuePosition(); }
  }
  listen(window, 'hashchange', hashLocation);
  listen(window, 'popstate', () => { initialAnchorPending = false; hashLocation(); });
  function suspend() {
    initialAnchorPending = false;
    cancelLocation();
    cancelAnimationFrame(positionFrame);
    positionFrame = 0;
  }
  listen(window, 'pagehide', event => { if (event.persisted) suspend(); else reading.destroyReadingMotion(); });
  listen(window, 'pageshow', event => { if (event.persisted) queuePosition(); });
  listen(document, 'visibilitychange', () => { if (document.hidden) suspend(); else queuePosition(); });
  listen(window, 'resize', queuePosition);
  listen(mobileDirectory, 'toggle', measureBookmarks);
  listen(reduced, 'change', () => {
    if (locating && reduced.matches) {
      const {index, focus} = locating;
      locate(index, {focus});
    } else clearHighlight();
    measureBookmarks();
  });
  const observer = new IntersectionObserver(queuePosition, {rootMargin: '-28% 0px -71% 0px'});
  headings.forEach(heading => observer.observe(heading));
  listen(window, 'scroll', queuePosition, {passive: true});
  let resize;
  if ('ResizeObserver' in window) {
    resize = new ResizeObserver(measureBookmarks);
    directories.forEach(nav => resize.observe(nav));
  }
  function settleInitialAnchor() {
    if (events.signal.aborted) return;
    measureBookmarks();
    const index = sections.findIndex(section => '#' + section.id === location.hash);
    if (initialAnchorPending && index >= 0 && Math.abs(scrollY - destination(index)) > 2) hashLocation();
  }
  if (document.fonts) document.fonts.ready.then(settleInitialAnchor);
  if (document.readyState === 'complete') settleInitialAnchor();
  else listen(window, 'load', settleInitialAnchor, {once: true});
  reading.destroyReadingMotion = () => {
    suspend();
    events.abort();
    observer.disconnect();
    resize?.disconnect();
    bookmarks.forEach(({marker, links}) => { marker.remove(); links.forEach(link => link.removeAttribute('aria-current')); });
    headings.forEach(heading => heading.removeAttribute('tabindex'));
    sections.forEach(section => section.classList.remove('reading-current-question'));
    currentLabel.hidden = true;
    reading.classList.remove('reading-motion-ready');
    delete reading.destroyReadingMotion;
  };
  reading.classList.add('reading-motion-ready');
  updatePosition();
})();
