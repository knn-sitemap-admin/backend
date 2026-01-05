(function () {
  function safe(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  function statusBadge(statusCode) {
    const n = Number(statusCode || 0);
    if (n >= 500) return `<span class="badge badge--danger">${n}</span>`;
    if (n >= 400) return `<span class="badge badge--warn">${n}</span>`;
    return `<span class="badge badge--ok">${n}</span>`;
  }

  async function ensureCssOnce(href) {
    const exists = document.querySelector(`link[data-owner-href="${href}"]`);
    if (exists) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-owner-href', href);
    document.head.appendChild(link);
  }

  async function fetchHtml(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('fetch failed: ' + url);
    return await res.text();
  }

  async function openLogModal(modalRoot, id) {
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

  async function fetchLogs({ page, pageSize }) {
    const res = await fetch(
      `/owner/api/logs?page=${page}&pageSize=${pageSize}`,
      {
        credentials: 'include',
      },
    );
    const json = await res.json();
    return { res, json };
  }

  async function render({ box, modalRoot, page, pageSize }) {
    box.innerHTML = `
      <div class="table-loading">
        <div class="spinner"></div>
        <div class="table-loading__text">불러오는 중...</div>
      </div>
    `;

    const { res, json } = await fetchLogs({ page, pageSize });
    if (!res.ok) {
      box.innerHTML = `<div class="muted">불러오기 실패</div>`;
      return { totalPages: 1 };
    }

    const data = json.data || {};
    const rows = data.items || [];

    const totalPages = Math.max(
      1,
      Math.ceil((data.total || 0) / (data.pageSize || pageSize)),
    );

    const label = document.getElementById('api-logs-page-label');
    if (label)
      label.textContent = `${data.page} / ${totalPages} (total ${data.total})`;

    let html = '';
    html += `<table class="table table--compact">`;
    html += `<thead><tr>`;
    html += `<th>시간</th>`;
    html += `<th>cid</th>`;
    html += `<th>device</th>`;
    html += `<th>method</th>`;
    html += `<th>path</th>`;
    html += `<th>status</th>`;
    html += `<th>ms</th>`;
    html += `</tr></thead><tbody>`;

    for (const r of rows) {
      html += `<tr class="tr" data-log-id="${safe(r.id)}">`;
      html += `<td>${safe(r.created_at)}</td>`;
      html += `<td>${safe(r.credential_id)}</td>`;
      html += `<td>${safe(r.device_type)}</td>`;
      html += `<td>${safe(r.method)}</td>`;
      html += `<td class="td-ellipsis" title="${safe(r.path)}">${safe(r.path)}</td>`;
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
        if (id) openLogModal(modalRoot, id);
      });
    }

    return { totalPages };
  }

  async function init({ modalRootId, tableId }) {
    await ensureCssOnce('/static/owner/api-logs.css');

    const modalRoot = document.getElementById(modalRootId);
    const box = document.getElementById(tableId);
    if (!box || !modalRoot) return;

    let page = Number(box.getAttribute('data-page') || '1');
    const pageSize = Number(box.getAttribute('data-page-size') || '20');

    const prevBtn = document.getElementById('api-logs-prev');
    const nextBtn = document.getElementById('api-logs-next');

    async function rerender() {
      const { totalPages } = await render({ box, modalRoot, page, pageSize });
      if (prevBtn) prevBtn.disabled = page <= 1;
      if (nextBtn) nextBtn.disabled = page >= totalPages;
    }

    if (prevBtn) {
      prevBtn.onclick = () => {
        if (page > 1) {
          page--;
          rerender();
        }
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        page++;
        rerender();
      };
    }

    // 엑셀 링크는 EJS에 이미 있으니 굳이 덮어쓸 필요 없음
    await rerender();
  }

  window.OwnerApiLogs = { init };
})();
