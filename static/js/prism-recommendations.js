(() => {
  const section = document.querySelector("[data-prism-recommendations]");
  if (!section) return;
  const items = [...section.querySelectorAll("[data-prism-item]")];
  const books = items.map(item => item.querySelector(".prism-book"));
  const captions = items.map(item => item.querySelector(".prism-caption"));
  const track = section.querySelector(".prism-track");
  const keyboardHelp = section.querySelector("#prism-keyboard-help");
  const announcement = section.querySelector("[data-prism-announcement]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reduced.matches;
  const intervalMs = 2500;
  const storageKey = `xy-prism-recommendations-v2:${location.pathname}`;
  let index = 0;
  let manualPaused = false;
  let hovering = false;
  let keyboardFocus = false;
  let inView = false;
  let pageActive = true;
  let enhanced = false;
  let timer = null;

  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    const previous = items.findIndex(item => item.dataset.itemId === saved?.itemId);
    if (previous >= 0) index = previous;
    manualPaused = saved?.manualPaused === true;
  } catch (_) { /* Storage may be disabled; browsing remains local to this page. */ }

  function save() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        itemId: items[index]?.dataset.itemId,
        manualPaused
      }));
    } catch (_) { /* No persistence is required to read a recommendation. */ }
  }

  function reasons() {
    return [
      !enhanced && "static",
      items.length < 2 && "single",
      manualPaused && "manual",
      hovering && "hover",
      keyboardFocus && "focus",
      !inView && "offscreen",
      (document.hidden || !pageActive) && "hidden",
      reducedMotion && "reduced"
    ].filter(Boolean);
  }

  function stopTimer() {
    clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    stopTimer();
    const pausedBy = reasons();
    if (!pausedBy.length) {
      timer = setTimeout(() => {
        timer = null;
        select(index + 1, false);
      }, intervalMs);
    }
  }

  function layout() {
    if (!enhanced) return;
    const width = books[0].offsetWidth;
    const step = Math.min(194, Math.max(108, (track.clientWidth - width - 40) / 4));
    books.forEach((book, i) => {
      let distance = (i - index + items.length) % items.length;
      if (distance > items.length / 2) distance -= items.length;
      const away = Math.abs(distance) > 2;
      book.dataset.prismDistance = String(distance);
      book.toggleAttribute("data-prism-away", away);
      book.style.setProperty("--prism-x", `${distance * step}px`);
      book.style.setProperty("--prism-z", `${-Math.abs(distance) * 108}px`);
      book.style.setProperty("--prism-angle", `${-distance * 23}deg`);
      book.style.setProperty("--prism-scale", String(1 - Math.min(Math.abs(distance), 3) * .08));
      book.style.setProperty("--prism-depth", String(10 - Math.abs(distance)));
      book.tabIndex = i === index ? 0 : -1;
      book.setAttribute("aria-hidden", String(away));
      if (i === index) book.setAttribute("aria-current", "true");
      else book.removeAttribute("aria-current");
      captions[i].classList.toggle("is-current", i === index);
      captions[i].inert = i !== index;
      captions[i].setAttribute("aria-hidden", String(i !== index));
    });
  }

  function select(next, manual) {
    index = (next + items.length) % items.length;
    if (manual) {
      manualPaused = true;
      announcement.textContent = section.dataset.prismPosition
        .replace("{number}", index + 1)
        .replace("{title}", captions[index].querySelector("h3").textContent.trim());
    }
    layout();
    save();
    schedule();
  }

  function configure() {
    stopTimer();
    enhanced = items.length > 1 && !reducedMotion && "IntersectionObserver" in window;
    section.classList.toggle("is-prism-enhanced", enhanced);
    section.classList.add("prism-settled");
    keyboardHelp.hidden = !enhanced;
    books.forEach(book => {
      if (enhanced) book.setAttribute("aria-describedby", "prism-keyboard-help");
      else book.removeAttribute("aria-describedby");
    });
    if (enhanced) {
      layout();
      // Complete the initial positions before enabling transitions.
      track.getBoundingClientRect();
    } else {
      books.forEach((book, i) => {
        book.removeAttribute("tabindex");
        book.removeAttribute("aria-hidden");
        book.removeAttribute("aria-current");
        book.removeAttribute("data-prism-away");
        captions[i].inert = false;
        captions[i].removeAttribute("aria-hidden");
      });
    }
    section.classList.remove("prism-settled");
    schedule();
  }

  Object.defineProperty(section, "getRecommendationState", {value: () => {
    const pausedBy = reasons();
    return {
      count: items.length, index, activeId: items[index]?.dataset.itemId || null,
      timerCount: Number(timer !== null), intervalMs, manualPaused,
      paused: pausedBy.length > 0, reasons: pausedBy, enhanced
    };
  }});
  if (!items.length) return;

  items.forEach((item, i) => {
    item.addEventListener("click", event => {
      const link = event.target.closest("a");
      if (!link || event.defaultPrevented || event.button !== 0
          || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
          || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      index = i;
      save();
      stopTimer();
    });
  });
  books.forEach(book => {
    book.addEventListener("pointerenter", event => {
      if (event.pointerType === "touch") return;
      hovering = true;
      schedule();
    });
    book.addEventListener("pointerleave", () => {
      hovering = false;
      schedule();
    });
  });
  section.addEventListener("focusin", event => {
    keyboardFocus = event.target !== section && event.target.matches(":focus-visible");
    schedule();
  });
  section.addEventListener("focusout", event => {
    keyboardFocus = Boolean(event.relatedTarget && event.relatedTarget !== section && section.contains(event.relatedTarget)
      && event.relatedTarget.matches(":focus-visible"));
    schedule();
  });
  section.addEventListener("keydown", event => {
    if (!enhanced || !event.target.closest(".prism-book")
        || !["ArrowLeft", "ArrowRight", " "].includes(event.key)) return;
    event.preventDefault();
    if (event.key === " ") {
      manualPaused = !manualPaused;
      announcement.textContent = manualPaused ? section.dataset.prismPaused : section.dataset.prismResumed;
      save();
      schedule();
      return;
    }
    select(index + (event.key === "ArrowLeft" ? -1 : 1), true);
    books[index].focus({preventScroll: true});
  });
  document.addEventListener("visibilitychange", schedule);
  addEventListener("pagehide", () => {
    pageActive = false;
    save();
    stopTimer();
  });
  addEventListener("pageshow", () => {
    pageActive = true;
    hovering = false;
    keyboardFocus = document.activeElement !== section && section.contains(document.activeElement)
      && document.activeElement.matches(":focus-visible");
    layout();
    schedule();
  });
  addEventListener("resize", () => {
    section.classList.add("prism-settled");
    layout();
    track.getBoundingClientRect();
    section.classList.remove("prism-settled");
  });
  reduced.addEventListener("change", event => {
    reducedMotion = event.matches;
    configure();
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
      schedule();
    }, {threshold: [0, .15]});
    observer.observe(section.querySelector(".prism-viewport"));
  }
  configure();
})();
