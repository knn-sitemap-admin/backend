(function () {
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
    const serverEl = document.getElementById('kpi-server');
    const dbEl = document.getElementById('kpi-database');
    const redisEl = document.getElementById('kpi-redis');
    const updatedAtEl = document.getElementById('kpi-updated-at');

    // dashboard partial이 아직 없으면 종료
    if (!serverEl || !dbEl || !redisEl) return;

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
        updatedAtEl.textContent = `마지막 확인: ${new Date().toLocaleString()}`;
      }
    } catch {
      if (updatedAtEl) {
        updatedAtEl.textContent = '마지막 확인: 실패 (네트워크/서버 오류)';
      }
    }
  }

  function bindOpenFrontend() {
    const btn = document.getElementById('open-frontend-btn');
    if (!btn) return;

    // dashboard 탭 재진입 시 중복 바인딩 방지
    if (btn.getAttribute('data-bound') === '1') return;
    btn.setAttribute('data-bound', '1');

    btn.addEventListener('click', function () {
      const url = btn.getAttribute('data-url') || '';
      if (!url) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  let intervalId = null;

  async function init() {
    bindOpenFrontend();
    await renderHealth();

    // (원하면) 주기 갱신. 탭 재진입 시 중복 방지
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(renderHealth, 10000);
  }

  window.OwnerDashboard = { init };
})();
