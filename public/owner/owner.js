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

    if (tab === 'api-logs') initApiLogs();
    if (tab === 'error-logs') initErrorLogs();
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

  function statusBadge(statusCode) {
    const n = Number(statusCode || 0);
    if (n >= 500) return `<span class="badge badge--danger">${n}</span>`;
    if (n >= 400) return `<span class="badge badge--warn">${n}</span>`;
    return `<span class="badge badge--ok">${n}</span>`;
  }

  async function initEmployeeSessions() {
    const box = document.getElementById('employee-sessions-table');
    if (!box) return;

    let page = Number(box.getAttribute('data-page') || '1');
    const pageSize = Number(box.getAttribute('data-page-size') || '20');

    function safe(v) {
      return v === null || v === undefined ? '' : String(v);
    }

    function ellipsis(s, max) {
      const v = safe(s);
      if (!v) return '';
      if (v.length <= max) return v;
      return v.slice(0, max) + '…';
    }

    function badgeActive(isActive) {
      return isActive
        ? `<span class="badge badge--ok">active</span>`
        : `<span class="badge">-</span>`;
    }

    async function forceSignout(credentialId, device) {
      const res = await fetch(
        `/owner/api/employees/${credentialId}/force-signout?device=${device}`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );
      const json = await res.json();
      if (!res.ok) {
        alert(
          json && json.messages && json.messages[0]
            ? json.messages[0]
            : '강제 로그아웃 실패',
        );
        return;
      }
      await render();
    }

    async function render() {
      box.innerHTML = `
      <div class="table-loading">
        <div class="spinner"></div>
        <div class="table-loading__text">불러오는 중...</div>
      </div>
    `;

      const res = await fetch(
        `/owner/api/employees/sessions?page=${page}&pageSize=${pageSize}`,
        {
          credentials: 'include',
        },
      );
      const json = await res.json();
      const data = json.data;

      const totalPages = Math.max(
        1,
        Math.ceil((data.total || 0) / (data.pageSize || pageSize)),
      );
      const label = document.getElementById('employee-sessions-page-label');
      if (label)
        label.textContent = `${data.page} / ${totalPages} (total ${data.total})`;

      const rows = data.items || [];

      let html = '';
      html += `<table class="table">`;
      html += `<thead><tr>`;
      html += `<th style="width:90px;">cid</th>`;
      html += `<th style="width:160px;">이름</th>`;
      html += `<th style="width:140px;">직급</th>`;
      html += `<th style="width:240px;">email</th>`;
      html += `<th style="width:130px;">role</th>`;

      html += `<th style="width:110px;">PC</th>`;
      html += `<th style="width:190px;">PC last</th>`;
      html += `<th style="width:140px;">PC ip</th>`;
      html += `<th style="width:260px;">PC ua</th>`;
      html += `<th style="width:190px;">PC action</th>`;

      html += `<th style="width:110px;">Mobile</th>`;
      html += `<th style="width:190px;">Mobile last</th>`;
      html += `<th style="width:140px;">Mobile ip</th>`;
      html += `<th style="width:260px;">Mobile ua</th>`;
      html += `<th style="width:190px;">Mobile action</th>`;
      html += `</tr></thead><tbody>`;

      for (const r of rows) {
        html += `<tr>`;
        html += `<td>${safe(r.credentialId)}</td>`;
        html += `<td>${safe(r.name)}</td>`;
        html += `<td>${safe(r.positionRank)}</td>`;
        html += `<td>${safe(r.email)}</td>`;
        html += `<td>${safe(r.effectiveRole)}</td>`;

        // PC
        html += `<td>${badgeActive(r.pc && r.pc.isActive)}</td>`;
        html += `<td>${safe(r.pc && r.pc.lastAccessedAt)}</td>`;
        html += `<td>${safe(r.pc && r.pc.ip)}</td>`;
        html += `<td title="${safe(r.pc && r.pc.userAgent)}">${ellipsis(r.pc && r.pc.userAgent, 40)}</td>`;
        html += `<td>`;
        html += `<button class="btn btn--ghost" data-action="force" data-device="pc" data-cid="${safe(r.credentialId)}">PC 로그아웃</button>`;
        html += `</td>`;

        // Mobile
        html += `<td>${badgeActive(r.mobile && r.mobile.isActive)}</td>`;
        html += `<td>${safe(r.mobile && r.mobile.lastAccessedAt)}</td>`;
        html += `<td>${safe(r.mobile && r.mobile.ip)}</td>`;
        html += `<td title="${safe(r.mobile && r.mobile.userAgent)}">${ellipsis(r.mobile && r.mobile.userAgent, 40)}</td>`;
        html += `<td>`;
        html += `<button class="btn btn--ghost" data-action="force" data-device="mobile" data-cid="${safe(r.credentialId)}">Mobile 로그아웃</button>`;
        html += `<button class="btn" style="margin-left:8px;" data-action="force" data-device="all" data-cid="${safe(r.credentialId)}">전체 로그아웃</button>`;
        html += `</td>`;

        html += `</tr>`;
      }

      html += `</tbody></table>`;
      box.innerHTML = html;

      const prev = document.getElementById('employee-sessions-prev');
      const next = document.getElementById('employee-sessions-next');
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= totalPages;

      // 버튼 바인딩
      const btns = box.querySelectorAll('button[data-action="force"]');
      for (const b of btns) {
        b.addEventListener('click', async () => {
          const cid = b.getAttribute('data-cid');
          const device = b.getAttribute('data-device');
          if (!cid || !device) return;
          await forceSignout(cid, device);
        });
      }

      // export 링크
      const exportA = document.getElementById('employee-sessions-export');
      if (exportA) exportA.href = `/owner/api/employees/sessions/export.xlsx`;
    }

    const prevBtn = document.getElementById('employee-sessions-prev');
    const nextBtn = document.getElementById('employee-sessions-next');
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

    await render();
  }

  function safe(v) {
    return v === null || v === undefined ? '' : String(v);
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

  const hashTab = (location.hash || '').replace('#', '').trim();
  const defaultTab = window.__OWNER_DEFAULT_TAB__ || 'dashboard';
  const startTab = hashTab || defaultTab;

  await loadTab(startTab);
})();
