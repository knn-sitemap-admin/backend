(function () {
  const serverEl = document.getElementById('kpi-server');
  const dbEl = document.getElementById('kpi-database');
  const redisEl = document.getElementById('kpi-redis');
  const updatedAtEl = document.getElementById('kpi-updated-at');

  const openFrontendBtn = document.getElementById('open-frontend-btn');

  function setPill(el, isLive) {
    if (!el) return;

    const text = isLive ? 'LIVE' : 'FAIL';
    const cls = isLive ? 'kpi-pill kpi-pill--ok' : 'kpi-pill kpi-pill--danger';

    el.innerHTML = `<span class="${cls}">${text}</span>`;
  }

  async function fetchHealth() {
    const res = await fetch('/', { credentials: 'include' });
    if (!res.ok) throw new Error('health fetch failed: ' + res.status);
    return await res.json();
  }

  async function renderHealth() {
    // 기본은 FAIL로 깔고 시작
    setPill(serverEl, false);
    setPill(dbEl, false);
    setPill(redisEl, false);

    try {
      const json = await fetchHealth();
      const data = json && json.data ? json.data : null;

      const statusOk = data && data.status === 'ok';
      const dbOk = data && data.database === 'ok';
      const redisOk = data && data.redis === 'ok';

      setPill(serverEl, statusOk);

      setPill(dbEl, dbOk);
      setPill(redisEl, redisOk);

      if (updatedAtEl) {
        const now = new Date();
        updatedAtEl.textContent = `마지막 확인: ${now.toLocaleString()}`;
      }
    } catch (e) {
      if (updatedAtEl)
        updatedAtEl.textContent = '마지막 확인: 실패 (네트워크/서버 오류)';
    }
  }

  function bindOpenFrontend() {
    if (!openFrontendBtn) return;

    openFrontendBtn.addEventListener('click', function () {
      const url = openFrontendBtn.getAttribute('data-url') || '';
      if (!url) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  bindOpenFrontend();
  renderHealth();
})();
