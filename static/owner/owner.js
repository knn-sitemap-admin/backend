// public/owner/owner.js
(async function () {
  const contentEl = document.getElementById('owner-content');
  const modalRoot = document.getElementById('owner-modal-root');

  const titleEl = document.getElementById('topbar-title');
  const descEl = document.getElementById('topbar-desc');

  const tabMeta = {
    dashboard: {
      title: 'Dashboard',
      desc: '서버 상태와 운영 데이터를 확인합니다.',
    },
    'employee-sessions': {
      title: 'employee-sessions',
      desc: '현재 활성 로그인(PC/Mobile) 상태만 표시합니다.',
    },
    'api-logs': { title: 'API Logs', desc: '전체 API 요청 로그를 확인합니다.' },
    'error-logs': {
      title: 'Error Logs',
      desc: 'status_code >= 400 (4xx + 5xx) 에러 로그만 표시합니다.',
    },
  };

  async function fetchHtml(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('fetch failed: ' + url);
    return await res.text();
  }

  function setActiveNav(tab) {
    const buttons = document.querySelectorAll('.nav__item[data-tab]');
    for (const btn of buttons) {
      const t = btn.getAttribute('data-tab');
      btn.classList.toggle('is-active', t === tab);
    }
    const meta = tabMeta[tab] || { title: tab, desc: '' };
    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;
  }

  function safe(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  function statusBadge(statusCode) {
    const n = Number(statusCode || 0);
    if (n >= 500) return `<span class="badge badge--danger">${n}</span>`;
    if (n >= 400) return `<span class="badge badge--warn">${n}</span>`;
    return `<span class="badge badge--ok">${n}</span>`;
  }

  function ensureScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const exists = document.querySelector(`script[data-owner-src="${src}"]`);
      if (exists) return resolve();

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-owner-src', src);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('failed to load script: ' + src));
      document.head.appendChild(s);
    });
  }

  function bindSidebar() {
    const buttons = document.querySelectorAll('.nav__item[data-tab]');
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (!tab) return;
        history.replaceState(null, '', `/owner#${tab}`);
        loadTab(tab);
      });
    }
  }

  async function loadTab(tab, qs) {
    setActiveNav(tab);
    contentEl.innerHTML = `
      <div class="skeleton">
        <div class="skeleton__bar"></div>
        <div class="skeleton__bar"></div>
        <div class="skeleton__bar"></div>
      </div>
    `;

    const q = qs ? '?' + new URLSearchParams(qs).toString() : '';
    const html = await fetchHtml(`/owner/partials/${tab}${q}`);
    contentEl.innerHTML = html;

    // 탭별 초기화
    if (tab === 'employee-sessions') {
      // 세션 탭 전용 코드 분리
      await ensureScriptOnce('/owner/employee-sessions.js');
      if (window.OwnerEmployeeSessions && window.OwnerEmployeeSessions.init) {
        await window.OwnerEmployeeSessions.init({
          modalRootId: 'owner-modal-root',
          tableId: 'employee-sessions-table',
        });
      }
      return;
    }

    if (tab === 'api-logs') initApiLogs();
    if (tab === 'error-logs') initErrorLogs();
  }

  async function initApiLogs() {
    const box = document.getElementById('api-logs-table');
    if (!box) return;

    let page = Number(box.getAttribute('data-page') || '1');
    const pageSize = Number(box.getAttribute('data-page-size') || '20');

    async function render() {
      box.innerHTML = `
        <div class="table-loading">
          <div class="spinner"></div>
          <div class="table-loading__text">불러오는 중...</div>
        </div>
      `;

      const res = await fetch(
        `/owner/api/logs?page=${page}&pageSize=${pageSize}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      const data = json.data;

      const totalPages = Math.max(
        1,
        Math.ceil((data.total || 0) / (data.pageSize || pageSize)),
      );
      const label = document.getElementById('api-logs-page-label');
      if (label)
        label.textContent = `${data.page} / ${totalPages} (total ${data.total})`;

      const rows = data.items || [];
      let html = '';
      html += `<table class="table">`;
      html += `<thead><tr>`;
      html += `<th style="width:180px;">시간</th>`;
      html += `<th style="width:90px;">cid</th>`;
      html += `<th style="width:80px;">device</th>`;
      html += `<th style="width:80px;">method</th>`;
      html += `<th>path</th>`;
      html += `<th style="width:110px;">status</th>`;
      html += `<th style="width:90px;">ms</th>`;
      html += `</tr></thead><tbody>`;

      for (const r of rows) {
        html += `<tr class="tr" data-log-id="${safe(r.id)}">`;
        html += `<td>${safe(r.created_at)}</td>`;
        html += `<td>${safe(r.credential_id)}</td>`;
        html += `<td>${safe(r.device_type)}</td>`;
        html += `<td>${safe(r.method)}</td>`;
        html += `<td>${safe(r.path)}</td>`;
        html += `<td>${statusBadge(r.status_code)}</td>`;
        html += `<td>${safe(r.duration_ms)}</td>`;
        html += `</tr>`;
      }
      html += `</tbody></table>`;

      box.innerHTML = html;

      const trs = box.querySelectorAll('tr[data-log-id]');
      for (const tr of trs) {
        tr.addEventListener('click', () => {
          const id = tr.getAttribute('data-log-id');
          if (id) openLogModal(id);
        });
      }

      const prev = document.getElementById('api-logs-prev');
      const next = document.getElementById('api-logs-next');
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= totalPages;
    }

    const prevBtn = document.getElementById('api-logs-prev');
    const nextBtn = document.getElementById('api-logs-next');

    if (prevBtn)
      prevBtn.onclick = () => {
        if (page > 1) {
          page--;
          render();
        }
      };
    if (nextBtn)
      nextBtn.onclick = () => {
        page++;
        render();
      };

    const exportA = document.getElementById('api-logs-export');
    if (exportA) exportA.href = `/owner/api/logs/export.xlsx`;

    await render();
  }

  async function initErrorLogs() {
    const box = document.getElementById('error-logs-table');
    if (!box) return;

    let page = Number(box.getAttribute('data-page') || '1');
    const pageSize = Number(box.getAttribute('data-page-size') || '20');

    async function render() {
      box.innerHTML = `
        <div class="table-loading">
          <div class="spinner"></div>
          <div class="table-loading__text">불러오는 중...</div>
        </div>
      `;

      const res = await fetch(
        `/owner/api/error-logs?page=${page}&pageSize=${pageSize}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      const data = json.data;

      const totalPages = Math.max(
        1,
        Math.ceil((data.total || 0) / (data.pageSize || pageSize)),
      );
      const label = document.getElementById('error-logs-page-label');
      if (label)
        label.textContent = `${data.page} / ${totalPages} (total ${data.total})`;

      const rows = data.items || [];
      let html = '';
      html += `<table class="table">`;
      html += `<thead><tr>`;
      html += `<th style="width:180px;">시간</th>`;
      html += `<th style="width:90px;">cid</th>`;
      html += `<th style="width:80px;">device</th>`;
      html += `<th style="width:80px;">method</th>`;
      html += `<th>path</th>`;
      html += `<th style="width:110px;">status</th>`;
      html += `<th style="width:90px;">ms</th>`;
      html += `</tr></thead><tbody>`;

      for (const r of rows) {
        html += `<tr class="tr" data-log-id="${safe(r.id)}">`;
        html += `<td>${safe(r.created_at)}</td>`;
        html += `<td>${safe(r.credential_id)}</td>`;
        html += `<td>${safe(r.device_type)}</td>`;
        html += `<td>${safe(r.method)}</td>`;
        html += `<td>${safe(r.path)}</td>`;
        html += `<td>${statusBadge(r.status_code)}</td>`;
        html += `<td>${safe(r.duration_ms)}</td>`;
        html += `</tr>`;
      }
      html += `</tbody></table>`;

      box.innerHTML = html;

      const trs = box.querySelectorAll('tr[data-log-id]');
      for (const tr of trs) {
        tr.addEventListener('click', () => {
          const id = tr.getAttribute('data-log-id');
          if (id) openLogModal(id);
        });
      }

      const prev = document.getElementById('error-logs-prev');
      const next = document.getElementById('error-logs-next');
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= totalPages;
    }

    const prevBtn = document.getElementById('error-logs-prev');
    const nextBtn = document.getElementById('error-logs-next');

    if (prevBtn)
      prevBtn.onclick = () => {
        if (page > 1) {
          page--;
          render();
        }
      };
    if (nextBtn)
      nextBtn.onclick = () => {
        page++;
        render();
      };

    const exportA = document.getElementById('error-logs-export');
    if (exportA) exportA.href = `/owner/api/error-logs/export.xlsx`;

    await render();
  }

  async function openLogModal(id) {
    const html = await fetchHtml(`/owner/partials/api-log-modal/${id}`);
    modalRoot.innerHTML = html;

    for (const el of modalRoot.querySelectorAll('[data-close="1"]')) {
      el.addEventListener('click', () => {
        modalRoot.innerHTML = '';
      });
    }

    const res = await fetch(`/owner/api/logs/${id}`, {
      credentials: 'include',
    });
    const json = await res.json();
    const row = json.data || {};

    const elReq = document.getElementById('pane-request');
    const elRes = document.getElementById('pane-response');
    const elQry = document.getElementById('pane-query');

    if (elReq) elReq.textContent = row.request_body || '';
    if (elRes) elRes.textContent = row.response_body || '';
    if (elQry) elQry.textContent = row.query_log || '';

    function activate(tab) {
      const tabs = modalRoot.querySelectorAll('.tab[data-tab]');
      const panes = modalRoot.querySelectorAll('.pane[data-pane]');

      for (const t of tabs) {
        t.classList.toggle('tab--active', t.getAttribute('data-tab') === tab);
      }
      for (const p of panes) {
        p.classList.toggle('pane--active', p.getAttribute('data-pane') === tab);
      }
    }

    for (const t of modalRoot.querySelectorAll('.tab[data-tab]')) {
      t.addEventListener('click', () => {
        const tab = t.getAttribute('data-tab');
        if (tab) activate(tab);
      });
    }

    activate('request');
  }

  bindSidebar();

  const appEl = document.querySelector('.app');
  const defaultTabFromDom = appEl
    ? appEl.getAttribute('data-default-tab')
    : null;

  const hashTab = (location.hash || '').replace('#', '').trim();
  const startTab = hashTab || defaultTabFromDom || 'dashboard';

  await loadTab(startTab);
})();
