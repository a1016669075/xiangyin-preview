(() => {
  const form = document.querySelector('#questionnaireconfig_form');
  if (!form) return;
  const state = document.querySelector('#questionnaire-state');
  const url = form.elements.url;
  const mode = form.elements.display_mode;
  const link = document.querySelector('#test-questionnaire');
  const savedUrl = state.dataset.savedUrl;
  const originalMessage = state.innerHTML;
  const showMode = () => {
    const row = form.querySelector('.field-embed_verified');
    if (row) row.hidden = mode.value !== 'embed';
  };
  const showLink = () => {
    const changed = url.value !== savedUrl;
    if (changed) {
      for (const name of ['is_verified', 'embed_verified', 'enabled']) form.elements[name].checked = false;
      state.textContent = '链接有修改尚未保存。先保存新链接，再打开测试、人工确认和开放入口。';
    } else {
      state.innerHTML = originalMessage;
    }
    if (link) {
      if (changed) {
        link.removeAttribute('href');
        link.textContent = '请先保存新链接';
      } else {
        link.href = savedUrl;
        link.textContent = '打开已保存的问卷，测试填写入口 ↗';
      }
    }
  };
  mode.addEventListener('change', showMode);
  url.addEventListener('input', showLink);
  showMode();
  showLink();
})();
