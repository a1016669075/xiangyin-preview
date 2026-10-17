/* Static, synthetic review build only. Runs before the shared interaction scripts. */
(() => {
  const data = window.XIANGYIN_PREVIEW;
  if (!data) return;
  const base = data.basePath;
  const path = document.body.dataset.pagesPath;
  const params = new URLSearchParams(location.search);
  const routes = {interview: 'interviews', media: 'media', research: 'research', policy: 'policies', survey_project: 'surveys'};
  const names = {interview: '访谈实录', media: '媒体中的方言', research: '方言学术研究', policy: '政策保护', survey_project: '方言社会调查'};
  const query = (params.get('q') || '').trim().slice(0, 200);
  const matches = item => !query || item.searchText.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const empty = '<div class="empty-state archive-empty"><h2>暂未找到匹配的资料。</h2><p>可以调整关键词或清除筛选，继续浏览。</p></div>';
  const select = (link, active) => active ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');

  // Each type has its own rendered template, preserving its media and policy layouts.
  if (path === '/library/' && routes[params.get('type')]) {
    const target = routes[params.get('type')];
    params.delete('type');
    location.replace(`${base}/${target}/${params.size ? '?' + params : ''}${location.hash}`);
    return;
  }
  document.querySelectorAll('a[href]').forEach(link => {
    const url = new URL(link.href);
    if (url.origin === location.origin && url.pathname === base + '/library/' && routes[url.searchParams.get('type')]) {
      url.pathname = `${base}/${routes[url.searchParams.get('type')]}/`;
      url.searchParams.delete('type');
      link.href = url.pathname + url.search + url.hash;
    }
  });

  // Restore the server-rendered region state before site.js binds its one controller.
  if (path === '/' && data.homeStates[params.get('region')]) {
    const state = data.homeStates[params.get('region')];
    const panel = document.querySelector('#region-panel');
    panel.querySelector('[data-region-name]').textContent = state.region.name;
    panel.querySelector('[data-region-description]').textContent = state.region.description;
    panel.querySelector('[data-region-count]').textContent = state.region.active_count;
    panel.querySelector('[data-region-contents]').innerHTML = state.contentsHtml;
    panel.querySelector('[data-region-link]').href = `${base}/regions/${state.region.slug}/`;
    document.querySelectorAll('[data-region]').forEach(link => {
      const active = link.dataset.region === state.region.slug;
      link.classList.toggle('is-selected', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }
  if (path === '/') {
    const closed = params.get('panel') === 'closed';
    document.querySelector('#app-shell').classList.toggle('panel-closed', closed);
    document.querySelector('#region-panel').hidden = closed;
    document.querySelector('#reopen-panel').hidden = !closed;
  }

  const kind = Object.keys(routes).find(key => path === `/${routes[key]}/`) || '';
  const listing = path === '/library/' || Boolean(kind);
  const regionSlug = path.match(/^\/regions\/([a-zA-Z0-9_-]+)\/$/)?.[1];
  const sort = ['recommended', 'latest', 'title'].includes(params.get('sort')) ? params.get('sort') : 'recommended';
  const addHidden = (form, name, value) => {
    let input = form.querySelector(`[name=${name}]`);
    if (!input) { input = document.createElement('input'); input.type = 'hidden'; input.name = name; form.append(input); }
    input.value = value;
  };
  const form = document.querySelector('.archive-search');
  if (form) {
    form.querySelector('[name=q]').value = query;
    for (const name of ['category', 'topic', 'kind']) {
      if (!params.get(name)) continue;
      addHidden(form, name, params.get(name));
    }
    if (listing) addHidden(form, 'sort', sort);
  }
  const sortForm = document.querySelector('.archive-sort');
  if (sortForm) {
    sortForm.querySelector('[name=sort]').value = sort;
    for (const name of ['q', 'category', 'topic', 'kind', 'type']) {
      if (params.get(name)) addHidden(sortForm, name, params.get(name));
    }
  }
  const clearUrl = (values = {}) => {
    const url = new URL(base + path, location.origin);
    if (listing && sort !== 'recommended') url.searchParams.set('sort', sort);
    for (const [name, value] of Object.entries(values)) if (value) url.searchParams.set(name, value);
    return url.pathname + url.search;
  };
  const paginate = items => {
    items.sort((a, b) => a.sortRanks[sort] - b.sortRanks[sort]);
    const pageSize = data.pageSize;
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const rawPage = (params.get('page') || '').trim();
    let page = /^[+-]?\d+$/.test(rawPage) ? Number(rawPage) : 1;
    if (page < 1 || page > pageCount) page = pageCount;
    const nav = document.querySelector('[data-pagination]');
    nav.replaceChildren(); nav.hidden = pageCount === 1;
    const pageLink = (number, label, rel = '') => {
      const link = document.createElement('a');
      const url = new URL(location.href);
      url.searchParams.set('sort', sort); url.searchParams.set('page', number);
      link.href = url.pathname + url.search;
      link.textContent = label;
      link.setAttribute('aria-label', `第 ${number} 页`);
      if (rel) link.rel = rel;
      return link;
    };
    if (page > 1) nav.append(pageLink(page - 1, '上一页', 'prev'));
    const sequence = pageCount <= 4 ? Array.from({length: pageCount}, (_, index) => index + 1)
      : [...(page > 3 ? [1, '…', page - 1, page] : Array.from({length: page}, (_, index) => index + 1)),
         ...(page < pageCount - 3 ? [page + 1, '…', pageCount] : Array.from({length: pageCount - page}, (_, index) => page + index + 1))];
    for (const number of sequence) {
      if (number !== page && number !== '…') { nav.append(pageLink(number, String(number))); continue; }
      const marker = document.createElement('span'); marker.textContent = number;
      if (number === page) { marker.setAttribute('aria-current', 'page'); marker.setAttribute('aria-label', `第 ${page} 页`); }
      else marker.className = 'pagination-gap';
      nav.append(marker);
    }
    if (page < pageCount) nav.append(pageLink(page + 1, '下一页', 'next'));
    const current = document.createElement('span'); current.className = 'pagination-status';
    current.textContent = `第 ${page} / ${pageCount} 页`; nav.append(current);
    const range = document.querySelector('[data-results-range]');
    range.textContent = items.length ? `当前第 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, items.length)} 份` : '';
    return items.slice((page - 1) * pageSize, page * pageSize);
  };
  const results = document.querySelector('.results-meta');
  const showCount = (text, clear) => {
    results.querySelector('span').textContent = text;
    results.querySelector('a')?.remove();
    if (clear) {
      const link = document.createElement('a'); link.href = clear; link.textContent = '清除筛选'; results.append(link);
    }
  };
  if (listing) {
    const category = kind === 'media' ? params.get('category') : '';
    const topic = kind === 'research' ? params.get('topic') : '';
    const media = document.querySelector('[data-media-discovery]');
    if (media && data.categories.some(item => item.slug === category)) {
      media.dataset.activeKind = category;
      media.querySelectorAll('[data-preview-art]').forEach(image => image.classList.toggle('is-active', image.dataset.previewArt === category));
      media.querySelectorAll('[data-preview-note]').forEach(note => { note.hidden = note.dataset.previewNote !== category; });
    }
    const items = data.items.filter(item => (kind ? item.kind === kind : item.kind !== 'survey_project')
      && (!category || item.category === category) && (!topic || item.topic === topic) && matches(item));
    document.querySelector('.archive-list').innerHTML = paginate(items).map(item => item.cardHtml).join('') || empty;
    showCount(`${query ? '“' + query + '” · ' : ''}${items.length} 份资料`, query || category || topic ? clearUrl() : '');
    document.querySelectorAll('.library-tabs a').forEach(link => select(link, new URL(link.href).pathname === base + path));
    document.querySelectorAll('.filter-list a, .xy-media-link').forEach(link => {
      const url = new URL(link.href);
      if (query) url.searchParams.set('q', query);
      url.searchParams.set('sort', sort); url.searchParams.delete('page');
      link.href = url.pathname + url.search;
      select(link, url.pathname === base + path && (url.searchParams.get('category') || '') === (category || '')
        && (url.searchParams.get('topic') || '') === (topic || ''));
    });
  }
  if (regionSlug) {
    const region = data.regions.find(item => item.slug === regionSlug);
    const selected = params.get('kind') || '';
    const all = data.items.filter(item => item.regions.includes(regionSlug) && matches(item));
    const groupKind = item => ['interview', 'media'].includes(item.kind) ? item.kind : 'related';
    const groups = {interview: 'region-interviews', media: 'region-works', related: 'region-related'};
    for (const [key, id] of Object.entries(groups)) {
      const section = document.querySelector(`[aria-labelledby=${id}]`);
      const items = all.filter(item => groupKind(item) === key);
      section.hidden = Boolean(selected && selected !== key);
      section.querySelector('h2 span').textContent = items.length;
      section.querySelector('.archive-list').innerHTML = items.map(item => item.cardHtml).join('') || '<p class="empty-line">当前分组暂无匹配资料。</p>';
    }
    const filtered = selected ? all.filter(item => groupKind(item) === selected) : all;
    showCount(`${region.name} · ${names[selected] || (selected === 'related' ? '研究、政策与项目' : '全部类型')} · ${query ? '“' + query + '” · ' : ''}本次 ${filtered.length} 份`,
      query ? clearUrl({kind: selected}) : '');
    document.querySelectorAll('.library-tabs a').forEach(link => {
      const url = new URL(link.href);
      const group = url.searchParams.get('kind') || '';
      select(link, group === selected);
      link.querySelector('span').textContent = `(${group ? all.filter(item => groupKind(item) === group).length : all.length})`;
      if (query) url.searchParams.set('q', query);
      link.href = url.pathname + url.search;
    });
  }
  if (listing || regionSlug) {
    document.querySelectorAll('.archive-list .content-card a[href]').forEach(link => {
      const url = new URL(link.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(base + '/content/')) return;
      url.searchParams.set('from', location.pathname + location.search + location.hash);
      link.href = url.pathname + url.search;
    });
    document.querySelectorAll('.library-tabs a').forEach(link => {
      const url = new URL(link.href);
      if (query) url.searchParams.set('q', query);
      if (listing) { url.searchParams.set('sort', sort); url.searchParams.delete('page'); }
      link.href = url.pathname + url.search;
    });
  }

  if (path.startsWith('/content/')) {
    const from = params.get('from');
    if (!from || !from.startsWith(base + '/') || /[\\\r\n]/.test(from)) return;
    const url = new URL(from, location.origin);
    const route = url.pathname.slice(base.length);
    if (url.origin !== location.origin || !/^\/(?:|library\/|interviews\/|media\/|research\/|policies\/|surveys\/|regions\/(?:[a-zA-Z0-9_-]+\/)?)$/.test(route)) return;
    const region = data.regions.find(item => route === `/regions/${item.slug}/` || (route === '/' && url.searchParams.get('region') === item.slug));
    const previousKind = Object.keys(routes).find(key => route === `/${routes[key]}/`);
    const label = region ? region.name + '资料' : names[previousKind] || (route === '/' ? '首页' : '方言资料');
    const back = document.querySelector('.back-link');
    back.href = url.pathname + url.search + url.hash; back.textContent = '返回' + label + ' →';
    const crumb = document.querySelectorAll('.breadcrumb a')[1];
    crumb.href = back.href; crumb.textContent = label;
  }
})();
