(() => {
  const messages = JSON.parse(document.getElementById("interface-messages").textContent);
  window.xyI18n = (key, values = {}) => messages[key].replace(
    /\{(\w+)\}/g, (_, name) => values[name] ?? ""
  );
  document.querySelectorAll(".language-switch").forEach((form) => {
    form.addEventListener("submit", () => {
      form.elements.next.value = location.pathname + location.search + location.hash;
    });
  });
})();
