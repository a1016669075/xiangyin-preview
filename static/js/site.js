document.documentElement.classList.add("js");

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");
if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(expanded));
    navigation.classList.toggle("is-open", expanded);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      navigation.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.focus();
    }
  });
}

// Keep the selected type visible inside its strip without scrolling the page.
document.querySelectorAll(".library-tabs").forEach((tabs) => {
  const selected = tabs.querySelector('[aria-current="page"]');
  if (!selected) return;
  const tabBounds = selected.getBoundingClientRect();
  const stripBounds = tabs.getBoundingClientRect();
  if (tabBounds.right > stripBounds.right) tabs.scrollLeft += tabBounds.right - stripBounds.right + 12;
});

const explorer = document.querySelector("[data-region-explorer]");
if (explorer) {
  const siteRoot = new URL(document.querySelector(".brand")?.href || "/", location.href).pathname.replace(/\/$/, "");
  const panel = explorer.querySelector("#region-panel");
  const body = panel.querySelector("#panel-body");
  const heading = panel.querySelector("[data-region-name]");
  const contents = panel.querySelector("[data-region-contents]");
  const status = explorer.querySelector("[data-region-status]");
  const errorBox = explorer.querySelector("[data-region-error]");
  const closeButton = explorer.querySelector("#close-panel");
  const reopenButton = explorer.querySelector("#reopen-panel");
  const template = document.querySelector("#region-card-template");
  const choices = [...explorer.querySelectorAll("[data-region]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tokens = getComputedStyle(explorer);
  const duration = (name) => parseFloat(tokens.getPropertyValue(`--region-${name}-duration`)) || 0;
  const offset = (name) => tokens.getPropertyValue(`--region-${name}`).trim() || "0px";
  const easing = tokens.getPropertyValue("--motion-ease").trim() || "ease";
  let committed = choices.find((link) => link.getAttribute("aria-current") === "true")?.dataset.region || "";
  let closed = new URL(location.href).searchParams.get("panel") === "closed";
  let operationId = 0;
  let currentOperation = null;
  let leaving = false;
  let historyNavigation = false;
  let returnFocusOnShow = false;
  let focusedItem = "";
  const positions = new Map();

  const announce = (message) => { if (status) status.textContent = message; };
  const isCurrent = (operation) => currentOperation === operation && operation.id === operationId && !leaving;
  const clearOperation = () => {
    operationId += 1;
    const previous = currentOperation;
    currentOperation = null;
    previous?.controller.abort();
    previous?.animation?.cancel();
    choices.forEach((link) => link.classList.remove("is-pending"));
    panel.removeAttribute("aria-busy");
  };
  const storageKey = (slug) => `xy-region:${siteRoot}:${slug}`;
  const readPosition = (slug) => {
    if (positions.has(slug)) return positions.get(slug);
    try { return JSON.parse(sessionStorage.getItem(storageKey(slug))) || {}; } catch { return {}; }
  };
  const savePosition = (restoreFocus = false) => {
    if (!committed) return;
    const position = { region: committed, scrollTop: closed ? (readPosition(committed).scrollTop || 0) : body.scrollTop,
      focusId: focusedItem, restoreFocus };
    positions.set(committed, position);
    try { sessionStorage.setItem(storageKey(committed), JSON.stringify(position)); } catch { /* Storage is optional. */ }
    history.replaceState({ ...history.state, xyRegion: position }, "", location.href);
  };
  const restorePosition = (withFocus = false) => {
    const saved = history.state?.xyRegion?.region === committed ? history.state.xyRegion : readPosition(committed);
    body.scrollTop = Number.isFinite(saved.scrollTop) ? saved.scrollTop : 0;
    focusedItem = typeof saved.focusId === "string" ? saved.focusId : "";
    if (withFocus && !closed && !document.hidden) {
      const card = [...contents.querySelectorAll("[data-content-id]")].find((node) => node.dataset.contentId === focusedItem);
      (card?.querySelector("[data-title]") || heading)?.focus({ preventScroll: true });
    }
  };
  const syncPanel = () => {
    explorer.classList.toggle("panel-closed", closed);
    panel.hidden = closed;
    if (reopenButton) { reopenButton.hidden = !closed; reopenButton.setAttribute("aria-expanded", String(!closed)); }
  };
  const urlFor = (slug, isClosed = false) => {
    const url = new URL(location.href);
    url.searchParams.set("region", slug);
    if (isClosed) url.searchParams.set("panel", "closed");
    else url.searchParams.delete("panel");
    if (!['#home-picks', '#home-latest', '#home-comments'].includes(url.hash)) url.hash = "";
    return url;
  };
  const refreshDetailOrigins = () => {
    const from = location.pathname + location.search + "#region-panel";
    const homeForm = explorer.querySelector('#home-comments .comment-form');
    if (homeForm) homeForm.action = location.pathname + location.search + '#home-comments';
    contents.querySelectorAll("a[href]").forEach((link) => {
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && url.pathname.startsWith(`${siteRoot}/content/`)) {
        url.searchParams.set("from", from);
        link.href = url.pathname + url.search + url.hash;
      }
    });
    explorer.querySelectorAll('[data-home-origin]').forEach((section) => {
      const fromHome = location.pathname + location.search + '#' + section.dataset.homeOrigin;
      section.querySelectorAll('a[href]').forEach((link) => {
        const url = new URL(link.href, location.href);
        if (url.origin === location.origin && url.pathname.startsWith(`${siteRoot}/content/`)) {
          url.searchParams.set('from', fromHome);
          link.href = url.pathname + url.search + url.hash;
        }
      });
    });
  };
  const animate = async (operation, phase) => {
    if (reducedMotion.matches || document.hidden || typeof body.animate !== "function" || !duration(phase)) return;
    const rest = { transform: "translate(0, 0)", opacity: 1 };
    const edge = { transform: phase === "open" ? `translateX(${offset("open-x")})` : `translateY(${offset(`${phase}-y`)})`, opacity: 0 };
    let animation;
    try {
      animation = body.animate(phase === "exit" ? [rest, edge] : [edge, rest], { duration: duration(phase), easing, fill: "both" });
      operation.animation = animation;
      await animation.finished;
    } catch (error) {
      if (error.name !== "AbortError") console.warn("Region transition could not play.", error);
    } finally {
      animation?.cancel();
      if (operation.animation === animation) operation.animation = null;
    }
  };
  const validLocalPath = (path) => {
    if (typeof path !== "string" || !path.startsWith(`${siteRoot}/`) || /[\\\r\n]/.test(path)) return false;
    const url = new URL(path, location.href);
    return url.origin === location.origin && url.pathname.startsWith(`${siteRoot}/`);
  };
  const prepareContents = (data, slug) => {
    if (!data || !data.region || data.region.slug !== slug || typeof data.region.name !== "string"
        || typeof data.region.description !== "string" || !Number.isInteger(data.region.active_count)
        || data.region.active_count < 0 || !Array.isArray(data.groups) || data.groups.length !== 4) throw new Error("Invalid region response");
    const fragment = document.createDocumentFragment();
    const groupKinds = { nonfiction: ["nonfiction"], interview: ["interview"], media: ["media"], related: ["research", "policy", "survey_project"] };
    const seen = new Set();
    let total = 0;
    for (const group of data.groups) {
      if (!groupKinds[group.key] || seen.has(group.key) || typeof group.label !== "string"
          || !Number.isInteger(group.total) || group.total < 0 || !Array.isArray(group.contents)
          || group.contents.length !== Math.min(group.total, 3)
          || group.url !== `${siteRoot}/regions/${slug}/?kind=${group.key}`) throw new Error("Invalid region group");
      seen.add(group.key);
      total += group.total;
      if (!group.total) continue;
      const section = document.createElement("section");
      section.className = "region-group";
      section.dataset.regionGroup = group.key;
      section.setAttribute("aria-labelledby", `panel-group-${group.key}`);
      const groupHeading = document.createElement("div");
      groupHeading.className = "group-heading";
      const title = document.createElement("h3");
      title.id = `panel-group-${group.key}`;
      title.textContent = group.label;
      const all = document.createElement("a");
      all.href = group.url;
      all.textContent = window.xyI18n("all_items", {count: group.total});
      groupHeading.append(title, all);
      section.append(groupHeading);
      for (const item of group.contents) {
        if (!item || !groupKinds[group.key].includes(item.kind) || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(item.id)
            || typeof item.title !== "string" || typeof item.summary !== "string"
            || item.url !== `${siteRoot}/content/${item.id}/`
            || !Array.isArray(item.meta_labels) || !item.meta_labels.every((label) => typeof label === "string")
            || typeof item.action_label !== "string" || typeof item.is_synthetic !== "boolean"
            || typeof item.cover_url !== "string" || (item.cover_url && !validLocalPath(item.cover_url))) throw new Error("Invalid region card");
        const card = template.content.cloneNode(true);
        const article = card.querySelector("[data-content-id]");
        article.dataset.contentId = item.id;
        const metadata = card.querySelector(".card-meta");
        const sample = card.querySelector("[data-sample]");
        item.meta_labels.forEach((label) => { const span = document.createElement("span"); span.textContent = label; metadata.insertBefore(span, sample); });
        sample.hidden = !item.is_synthetic;
        card.querySelector("[data-title]").textContent = item.title;
        card.querySelector("[data-title]").href = item.url;
        card.querySelector("[data-summary]").textContent = item.summary;
        card.querySelector("[data-summary]").hidden = !item.summary;
        card.querySelector("[data-link]").href = item.url;
        card.querySelector("[data-link-label]").textContent = item.action_label;
        const coverLink = card.querySelector("[data-cover-link]");
        if (item.cover_url) {
          coverLink.hidden = false;
          coverLink.href = item.url;
          card.querySelector("[data-cover]").src = item.cover_url;
          article.classList.add("has-cover");
        } else coverLink.remove();
        section.append(card);
      }
      fragment.append(section);
    }
    if (total !== data.region.active_count) throw new Error("Invalid region total");
    if (!total) {
      const empty = document.createElement("div");
      empty.className = "empty-state region-empty";
      const title = document.createElement("h3");
      title.textContent = window.xyI18n("empty_region");
      const note = document.createElement("p");
      note.textContent = window.xyI18n("empty_region_note");
      const link = document.createElement("a");
      link.className = "text-link";
      link.href = `${siteRoot}/regions/`;
      link.textContent = window.xyI18n("other_regions");
      empty.append(title, note, link);
      fragment.append(empty);
    }
    return fragment;
  };
  const openPanel = (focus = true) => {
    clearOperation();
    closed = false;
    syncPanel();
    history.replaceState(history.state, "", urlFor(committed));
    refreshDetailOrigins();
    restorePosition();
    if (focus && !document.hidden) heading?.focus({ preventScroll: true });
    announce(window.xyI18n("panel_opened"));
    const operation = { id: operationId, controller: new AbortController(), animation: null };
    currentOperation = operation;
    animate(operation, "open").then(() => { if (isCurrent(operation)) clearOperation(); });
  };
  const closePanel = () => {
    savePosition();
    clearOperation();
    closed = true;
    syncPanel();
    history.replaceState(history.state, "", urlFor(committed, true));
    refreshDetailOrigins();
    const origin = choices.find((link) => link.dataset.region === committed && link.classList.contains("region-map-province"))
      || choices.find((link) => link.dataset.region === committed) || reopenButton;
    origin?.focus({ preventScroll: true });
    announce(window.xyI18n("panel_closed"));
  };
  const chooseRegion = async (link) => {
    clearOperation();
    if (leaving) return;
    if (errorBox) { errorBox.hidden = true; errorBox.replaceChildren(); }
    if (link.dataset.region === committed) { if (closed) openPanel(false); return; }
    savePosition();
    const operation = { id: operationId, controller: new AbortController(), link, animation: null };
    currentOperation = operation;
    panel.setAttribute("aria-busy", "true");
    choices.filter((choice) => choice.dataset.region === link.dataset.region).forEach((choice) => choice.classList.add("is-pending"));
    announce(window.xyI18n("loading_region", {region: link.textContent.trim() || link.getAttribute("aria-label")}));
    let data, nextContents;
    try {
      const response = await fetch(link.dataset.api, { signal: operation.controller.signal, headers: { Accept: "application/json" } });
      if (!isCurrent(operation)) return;
      if (!response.ok) throw new Error("Region request failed");
      data = await response.json();
      if (!isCurrent(operation)) return;
      nextContents = prepareContents(data, link.dataset.region);
    } catch (error) {
      if (!isCurrent(operation)) return;
      clearOperation();
      announce(window.xyI18n("region_failed"));
      if (errorBox) {
        const note = document.createElement("p");
        note.textContent = window.xyI18n("region_error");
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = window.xyI18n("retry");
        retry.addEventListener("click", () => chooseRegion(link));
        const fallback = document.createElement("a");
        fallback.href = `${siteRoot}/regions/${encodeURIComponent(link.dataset.region)}/`;
        fallback.textContent = window.xyI18n("region_page");
        errorBox.replaceChildren(note, retry, fallback);
        errorBox.hidden = false;
      }
      return;
    }
    if (!closed) await animate(operation, "exit");
    if (!isCurrent(operation)) return;
    const wasClosed = closed;
    committed = data.region.slug;
    closed = false;
    focusedItem = "";
    heading.textContent = data.region.name;
    panel.querySelector("[data-region-description]").textContent = data.region.description;
    panel.querySelector("[data-region-count]").textContent = data.region.active_count;
    contents.replaceChildren(nextContents);
    panel.querySelector("[data-region-link]").href = `${siteRoot}/regions/${committed}/`;
    choices.forEach((choice) => {
      const selected = choice.dataset.region === committed;
      choice.classList.toggle("is-selected", selected);
      if (selected) choice.setAttribute("aria-current", "true"); else choice.removeAttribute("aria-current");
      choice.classList.remove("is-pending");
    });
    syncPanel();
    body.scrollTop = 0;
    history.pushState({ xyRegion: { region: committed, scrollTop: 0, focusId: "" } }, "", urlFor(committed));
    refreshDetailOrigins();
    panel.removeAttribute("aria-busy");
    announce(window.xyI18n("region_loaded", {region: data.region.name, count: data.region.active_count}));
    explorer.dispatchEvent(new CustomEvent("xiangyin:regionchange", {detail: {region: committed}}));
    await animate(operation, wasClosed ? "open" : "enter");
    if (isCurrent(operation)) clearOperation();
  };
  choices.forEach((link) => link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    chooseRegion(link);
  }));
  closeButton?.addEventListener("click", closePanel);
  reopenButton?.addEventListener("click", () => openPanel());
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.target.closest("form, input, textarea, select, [contenteditable=true]")) {
      event.preventDefault();
      closePanel();
    }
  });
  contents.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    const card = link?.closest("[data-content-id]");
    if (card) { focusedItem = card.dataset.contentId; savePosition(!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey); }
  });
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) currentOperation?.animation?.cancel(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) currentOperation?.animation?.cancel(); });
  window.addEventListener("pagehide", () => {
    if (!historyNavigation) savePosition(Boolean(readPosition(committed).restoreFocus));
    leaving = true;
    clearOperation();
  });
  window.addEventListener("pageshow", (event) => {
    leaving = false;
    if (event.persisted || returnFocusOnShow) {
      const lowerSection = ['#home-picks', '#home-latest', '#home-comments'].includes(location.hash);
      restorePosition(!lowerSection && (returnFocusOnShow || Boolean(readPosition(committed).restoreFocus)));
      savePosition(false);
      refreshDetailOrigins();
      returnFocusOnShow = false;
    }
  });
  window.addEventListener("popstate", () => {
    const target = new URL(location.href);
    if (target.searchParams.get('region') === committed && (target.searchParams.get('panel') === 'closed') === closed) return;
    historyNavigation = true;
    leaving = true;
    clearOperation();
    window.location.reload();
  });
  syncPanel();
  if (committed) {
    if (!new URL(location.href).searchParams.has("region")) history.replaceState(history.state, "", urlFor(committed, closed));
    returnFocusOnShow = Boolean(readPosition(committed).restoreFocus);
    restorePosition();
    refreshDetailOrigins();
  }
}
