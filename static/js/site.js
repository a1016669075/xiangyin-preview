document.documentElement.classList.add("js");

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");
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

const explorer = document.querySelector("[data-region-explorer]");
// Keep the selected type visible inside its strip without scrolling the page.
document.querySelectorAll(".library-tabs").forEach((tabs) => {
  const selected = tabs.querySelector('[aria-current="page"]');
  if (!selected) return;
  const tabBounds = selected.getBoundingClientRect();
  const stripBounds = tabs.getBoundingClientRect();
  if (tabBounds.right > stripBounds.right) tabs.scrollLeft += tabBounds.right - stripBounds.right + 12;
});
if (explorer) {
  const siteRoot = new URL(document.querySelector('.brand').href).pathname.replace(/\/$/, '');
  const panel = explorer.querySelector("#region-panel");
  const template = document.querySelector("#region-card-template");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 600px)");
  const choices = [...explorer.querySelectorAll("[data-region]")];
  let currentOperation;
  let leaving = false;

  const isCurrent = (operation) => currentOperation === operation && !leaving;
  const clearOperation = () => {
    const previous = currentOperation;
    currentOperation = null;
    previous?.controller.abort();
    previous?.animation?.cancel();
    previous?.link.classList.remove("is-pending");
    panel.removeAttribute("aria-busy");
  };
  const revealResults = () => {
    if (document.hidden) return;
    const action = panel.querySelector(".card-link") || panel;
    const bottom = action.getBoundingClientRect().bottom;
    if (bottom > window.innerHeight - 20) {
      window.scrollBy({ top: Math.min(bottom - window.innerHeight + 20, panel.getBoundingClientRect().top - 20) });
    }
  };
  const fold = async (operation, entering) => {
    if (reducedMotion.matches || document.hidden || typeof panel.animate !== "function") return;
    // Same visual trajectory as the stage-A reference; request ownership stays here.
    const small = compact.matches;
    const offset = entering ? (small ? 12 : 25) : (small ? -10 : -22);
    const angle = small ? 0 : (entering ? 17 : -18);
    const rest = { transform: "translateX(0) rotateY(0deg)", opacity: 1 };
    const edge = { transform: `translateX(${offset}px) rotateY(${angle}deg)`, opacity: entering ? (small ? 0.24 : 0.12) : (small ? 0.3 : 0.13) };
    let animation;
    try {
      animation = panel.animate(entering ? [edge, rest] : [rest, edge], {
        duration: small ? (entering ? 260 : 100) : (entering ? 680 : 210),
        easing: "cubic-bezier(.22,.72,.17,1)", fill: "both",
      });
      operation.animation = animation;
      await animation.finished;
    } catch (error) {
      // Cancellation ends only the visual layer; successfully fetched data stays valid.
      if (error.name !== "AbortError") console.warn("Region fold could not play.", error);
    } finally {
      animation?.cancel();
      if (operation.animation === animation) operation.animation = null;
    }
  };
  const prepareCards = (data, link) => {
    if (!data || !data.region || data.region.slug !== link.dataset.region
        || typeof data.region.name !== "string" || typeof data.region.description !== "string"
        || !Number.isInteger(data.region.active_count) || data.region.active_count < 0
        || !Array.isArray(data.contents)) throw new Error("Invalid region response");
    const cards = document.createDocumentFragment();
    const origin = new URL(link.href);
    for (const item of data.contents) {
      if (!item || !["interview", "media"].includes(item.kind)
          || typeof item.title !== "string" || typeof item.summary !== "string"
          || typeof item.url !== "string" || !item.url.startsWith(siteRoot + "/content/")
          || !/^\/content\/[a-zA-Z0-9_-]+\/$/.test(item.url.slice(siteRoot.length))
          || !Array.isArray(item.meta_labels) || !item.meta_labels.every((label) => typeof label === "string")
          || typeof item.action_label !== "string" || typeof item.is_synthetic !== "boolean") {
        throw new Error("Invalid region card");
      }
      const card = template.content.cloneNode(true);
      const metadata = card.querySelector(".card-meta");
      const sample = card.querySelector("[data-sample]");
      item.meta_labels.forEach((label) => {
        const span = document.createElement("span");
        span.textContent = label;
        metadata.insertBefore(span, sample);
      });
      sample.hidden = !item.is_synthetic;
      card.querySelector("[data-title]").textContent = item.title;
      const detailUrl = item.url + "?from=" + encodeURIComponent(origin.pathname + origin.search + origin.hash);
      card.querySelector("[data-title]").href = detailUrl;
      card.querySelector("[data-summary]").textContent = item.summary;
      card.querySelector("[data-summary]").hidden = !item.summary;
      card.querySelector("[data-link]").href = detailUrl;
      card.querySelector("[data-link-label]").textContent = item.action_label;
      cards.append(card);
    }
    if (!data.contents.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const heading = document.createElement("h3");
      heading.textContent = "这里的故事，正在整理。";
      const note = document.createElement("p");
      note.textContent = "本地区暂无访谈或作品，可查看全部地区资料。";
      empty.append(heading, note);
      cards.append(empty);
    }
    return cards;
  };
  for (const link of choices) {
    link.addEventListener("click", async (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      clearOperation();
      if (leaving) return;
      if (link.getAttribute("aria-current") === "true") {
        revealResults();
        return;
      }
      const operation = { controller: new AbortController(), link, animation: null };
      currentOperation = operation;
      panel.setAttribute("aria-busy", "true");
      link.classList.add("is-pending");
      let data, cards;
      try {
        const response = await fetch(link.dataset.api, { signal: operation.controller.signal, headers: { Accept: "application/json" } });
        if (!isCurrent(operation)) return;
        if (!response.ok) throw new Error("Region request failed");
        data = await response.json();
        if (!isCurrent(operation)) return;
        cards = prepareCards(data, link);
      } catch (error) {
        if (isCurrent(operation)) {
          clearOperation();
          window.location.assign(link.href);
        }
        return;
      }
      await fold(operation, false);
      if (!isCurrent(operation)) return;
      panel.querySelector("[data-region-name]").textContent = data.region.name;
      panel.querySelector("[data-region-description]").textContent = data.region.description;
      panel.querySelector("[data-region-count]").textContent = data.region.active_count;
      panel.querySelector("[data-region-contents]").replaceChildren(cards);
      panel.querySelector("[data-region-link]").href = `${siteRoot}/regions/${encodeURIComponent(data.region.slug)}/`;
      choices.forEach((choice) => {
        const selected = choice.dataset.region === data.region.slug;
        choice.classList.toggle("is-selected", selected);
        if (selected) choice.setAttribute("aria-current", "true");
        else choice.removeAttribute("aria-current");
      });
      history.pushState({ region: data.region.slug }, "", link.href);
      await fold(operation, true);
      if (!isCurrent(operation)) return;
      clearOperation();
      revealResults();
    });
  }
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) currentOperation?.animation?.cancel();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) currentOperation?.animation?.cancel();
  });
  window.addEventListener("pagehide", () => { leaving = true; clearOperation(); });
  window.addEventListener("pageshow", () => { leaving = false; });
  window.addEventListener("popstate", () => { leaving = true; clearOperation(); window.location.reload(); });
}
